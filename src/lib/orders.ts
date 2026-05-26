import { AvitoApiError, explainAvitoError } from "@/lib/avito/client";
import { createAvitoClient } from "@/lib/avito/factory";
import { recordAutomationEvent } from "@/lib/autoload";
import { prisma } from "@/lib/prisma";
import { getAutomationState } from "@/lib/reviews";
import { getRawAvitoSettings } from "@/lib/settings";
import { DEFAULT_SUPPLIER_MESSAGE_TEMPLATE } from "@/lib/suppliers";
import { toClientCustomerOrder, toClientSupplierTask } from "@/lib/serializers";

type JsonObject = Record<string, unknown>;

export async function listOrders(filters: { status?: string; taskStatus?: string } = {}) {
  const orders = await prisma.customerOrder.findMany({
    where: {
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.taskStatus ? { supplierTask: { is: { status: filters.taskStatus } } } : {}),
    },
    include: orderInclude,
    orderBy: [{ avitoCreatedAt: "desc" }, { createdAt: "desc" }],
  });
  return orders.map(toClientCustomerOrder);
}

export async function getOrder(id: string) {
  const order = await prisma.customerOrder.findUnique({
    where: { id },
    include: orderInclude,
  });
  return order ? toClientCustomerOrder(order) : null;
}

export async function updateSupplierTask(
  id: string,
  input: Partial<{ supplierId: string | null; generatedMessage: string; status: string; notes: string }>,
) {
  const statusDates = statusToDates(input.status);
  const task = await prisma.supplierTask.update({
    where: { id },
    data: {
      ...(input.supplierId !== undefined ? { supplierId: input.supplierId?.trim() || null } : {}),
      ...(input.generatedMessage !== undefined ? { generatedMessage: normalizeMessage(input.generatedMessage) } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
      ...statusDates,
      error: input.status && input.status !== "ERROR" ? null : undefined,
    },
    include: { supplier: true },
  });
  return toClientSupplierTask(task);
}

export async function syncOrders(options: { force?: boolean } = {}) {
  const state = await prisma.automationState.upsert({
    where: { id: "default" },
    create: { id: "default" },
    update: {},
  });
  if (!state.ordersEnabled && !options.force) {
    return { ok: false, skipped: true, synced: 0, tasks: 0, state: await getAutomationState(), message: "Синхронизация заказов выключена." };
  }

  const settings = await getRawAvitoSettings();
  if (!settings.clientId || !settings.clientSecret) {
    const updated = await markOrdersError("Заполните Client ID и Client Secret.", "ORDERS_NEEDS_SETTINGS");
    return { ok: false, synced: 0, tasks: 0, state: updated, message: "Заполните Client ID и Client Secret." };
  }

  const client = createAvitoClient(settings);
  try {
    const payload = await client.getOrders({ limit: 50, per_page: 50, page: 0 });
    const rawOrders = extractArray(payload, ["orders", "items", "data", "result", "results"]);
    let synced = 0;
    let tasks = 0;

    for (const rawOrder of rawOrders) {
      const normalized = normalizeOrderPayload(rawOrder);
      if (!normalized) continue;
      const matched = await matchLocalOrderTarget(normalized);
      const order = await upsertOrder(normalized, matched);
      const task = await ensureSupplierTask(order.id, {
        ...normalized,
        productId: matched.productId,
        variantId: matched.variantId,
        supplierId: matched.supplierId,
        productTitle: matched.productTitle,
        brand: matched.brand,
      });
      synced += 1;
      if (task.created) tasks += 1;
    }

    await prisma.automationState.upsert({
      where: { id: "default" },
      create: { id: "default", status: "ORDERS_SYNCED", lastOrdersSyncAt: new Date(), ordersEnabled: true },
      update: { status: "ORDERS_SYNCED", lastOrdersSyncAt: new Date(), ordersEnabled: true, lastError: null },
    });
    await recordAutomationEvent("orders_sync", "OK", `Synced ${synced} orders.`, payload);
    const automation = await getAutomationState();
    return { ok: true, synced, tasks, state: automation, payload, automation };
  } catch (error) {
    const message = readableAvitoError(error);
    const unavailable = error instanceof AvitoApiError && [0, 403, 404].includes(error.status);
    const updated = await markOrdersError(message, unavailable ? "ORDERS_UNAVAILABLE" : "ORDERS_ERROR", unavailable);
    return { ok: false, synced: 0, tasks: 0, state: updated, message };
  }
}

export function renderSupplierMessage(
  template: string,
  values: {
    supplierName?: string | null;
    contactName?: string | null;
    orderId?: string | null;
    itemTitle?: string | null;
    color?: string | null;
    size?: string | null;
    quantity?: number | null;
    price?: number | null;
    buyerName?: string | null;
    deliveryText?: string | null;
    shopName?: string | null;
    brand?: string | null;
  },
) {
  const replacements: Record<string, string> = {
    supplierName: values.supplierName || "",
    contactName: values.contactName || "",
    orderId: values.orderId || "",
    itemTitle: values.itemTitle || "",
    color: values.color || "не указан",
    size: values.size || "не указан",
    quantity: String(values.quantity ?? 1),
    price: values.price ? new Intl.NumberFormat("ru-RU").format(values.price) : "не указана",
    buyerName: values.buyerName || "",
    deliveryText: values.deliveryText || "",
    shopName: values.shopName || "SEB0G1SHOPCHIK",
    brand: values.brand || "",
  };
  return normalizeMessage((template || DEFAULT_SUPPLIER_MESSAGE_TEMPLATE).replace(/\{([a-zA-Z]+)\}/g, (_, key: string) => replacements[key] ?? ""));
}

export function selectSupplierId(input: {
  productSupplierId?: string | null;
  colorGroups: Array<{ color: string; avitoColorValue?: string | null; supplierId?: string | null }>;
  color?: string | null;
}) {
  const color = normalizeComparable(input.color);
  const group = input.colorGroups.find((item) => {
    const localColor = normalizeComparable(item.color);
    const avitoColor = normalizeComparable(item.avitoColorValue);
    return color && (localColor === color || avitoColor === color);
  });
  return group?.supplierId || input.productSupplierId || null;
}

const orderInclude = {
  product: { select: { id: true, title: true, brand: true } },
  variant: { select: { id: true, sku: true, color: true, size: true, price: true } },
  supplierTask: { include: { supplier: true } },
};

async function upsertOrder(order: NormalizedOrder, matched: MatchedOrderTarget) {
  return prisma.customerOrder.upsert({
    where: { avitoOrderId: order.avitoOrderId },
    create: {
      avitoOrderId: order.avitoOrderId,
      avitoItemId: order.avitoItemId,
      avitoChatId: order.avitoChatId,
      buyerName: order.buyerName,
      buyerPhone: order.buyerPhone,
      itemTitle: order.itemTitle,
      color: order.color ?? matched.color ?? null,
      size: order.size ?? matched.size ?? null,
      quantity: order.quantity,
      price: order.price,
      status: order.status,
      deliveryText: order.deliveryText,
      productId: matched.productId,
      variantId: matched.variantId,
      rawJson: order.rawJson,
      avitoCreatedAt: order.avitoCreatedAt,
    },
    update: {
      avitoItemId: order.avitoItemId,
      avitoChatId: order.avitoChatId,
      buyerName: order.buyerName,
      buyerPhone: order.buyerPhone,
      itemTitle: order.itemTitle,
      color: order.color ?? matched.color ?? null,
      size: order.size ?? matched.size ?? null,
      quantity: order.quantity,
      price: order.price,
      status: order.status,
      deliveryText: order.deliveryText,
      productId: matched.productId,
      variantId: matched.variantId,
      rawJson: order.rawJson,
      avitoCreatedAt: order.avitoCreatedAt,
    },
  });
}

async function ensureSupplierTask(orderId: string, input: NormalizedOrder & MatchedOrderTarget) {
  const supplier = input.supplierId ? await prisma.supplier.findUnique({ where: { id: input.supplierId } }) : null;
  const generatedMessage = supplier
    ? renderSupplierMessage(supplier.defaultMessageTemplate, {
        supplierName: supplier.name,
        contactName: supplier.contactName,
        orderId: input.avitoOrderId,
        itemTitle: input.itemTitle || input.productTitle,
        color: input.color,
        size: input.size,
        quantity: input.quantity,
        price: input.price,
        buyerName: input.buyerName,
        deliveryText: input.deliveryText,
        brand: input.brand,
      })
    : "Назначьте поставщика товару или цвету, после этого появится готовый текст сообщения.";

  const existing = await prisma.supplierTask.findUnique({ where: { orderId } });
  if (existing && ["DONE", "CANCELLED", "CONTACTED"].includes(existing.status)) {
    return { created: false, task: existing };
  }

  const task = await prisma.supplierTask.upsert({
    where: { orderId },
    create: {
      orderId,
      supplierId: supplier?.id ?? null,
      generatedMessage,
      status: supplier ? "NEW" : "NEEDS_SUPPLIER",
    },
    update: {
      supplierId: supplier?.id ?? null,
      generatedMessage,
      status: supplier ? "NEW" : "NEEDS_SUPPLIER",
      error: null,
    },
  });
  return { created: !existing, task };
}

async function matchLocalOrderTarget(order: NormalizedOrder): Promise<MatchedOrderTarget> {
  const directQuery = [order.avitoItemId, order.externalId, order.sku].filter(Boolean) as string[];
  let variant =
    directQuery.length > 0
      ? await prisma.productVariant.findFirst({
          where: {
            OR: directQuery.flatMap((value) => [{ avitoExternalId: value }, { sku: value }]),
          },
          include: { product: { include: { colorGroups: true } } },
        })
      : null;

  if (!variant && order.itemTitle) {
    const product = await prisma.productTemplate.findFirst({
      where: { title: { contains: order.itemTitle } },
      include: { colorGroups: true, variants: { take: 1 } },
    });
    if (product?.variants[0]) {
      variant = await prisma.productVariant.findUnique({
        where: { id: product.variants[0].id },
        include: { product: { include: { colorGroups: true } } },
      });
    }
  }

  if (!variant) {
    return { productId: null, variantId: null, supplierId: null, productTitle: order.itemTitle, brand: null, color: order.color, size: order.size };
  }

  const supplierId = selectSupplierId({
    productSupplierId: variant.product.supplierId,
    colorGroups: variant.product.colorGroups,
    color: order.color || variant.color,
  });
  return {
    productId: variant.productId,
    variantId: variant.id,
    supplierId,
    productTitle: variant.product.title,
    brand: variant.product.brand,
    color: order.color || variant.color,
    size: order.size || variant.size,
  };
}

function normalizeOrderPayload(payload: unknown): NormalizedOrder | null {
  if (!isObject(payload)) return null;
  const firstItem = firstObject(payload, ["items", "positions", "goods"]);
  const avitoOrderId = getString(payload, ["id", "order_id", "orderId", "number", "uuid"]);
  if (!avitoOrderId) return null;

  const avitoItemId =
    getString(payload, ["item_id", "itemId", "ad_id", "adId"]) ||
    getNestedString(payload, ["item", "id"]) ||
    getNestedString(payload, ["ad", "id"]) ||
    (firstItem ? getString(firstItem, ["item_id", "itemId", "ad_id", "id"]) : "");

  const itemTitle =
    getString(payload, ["item_title", "itemTitle", "ad_title", "adTitle", "title"]) ||
    getNestedString(payload, ["item", "title"]) ||
    getNestedString(payload, ["ad", "title"]) ||
    (firstItem ? getString(firstItem, ["title", "name", "item_title", "itemTitle"]) : "");

  return {
    avitoOrderId,
    avitoItemId: avitoItemId || null,
    externalId: getString(payload, ["external_id", "externalId", "ad_external_id"]) || (firstItem ? getString(firstItem, ["external_id", "sku"]) : ""),
    sku: getString(payload, ["sku"]) || (firstItem ? getString(firstItem, ["sku", "article"]) : ""),
    avitoChatId: getString(payload, ["chat_id", "chatId"]) || getNestedString(payload, ["chat", "id"]) || null,
    buyerName: getNestedString(payload, ["buyer", "name"]) || getNestedString(payload, ["customer", "name"]) || getString(payload, ["buyer_name", "customer_name"]) || null,
    buyerPhone: getNestedString(payload, ["buyer", "phone"]) || getNestedString(payload, ["customer", "phone"]) || getString(payload, ["buyer_phone", "phone"]) || null,
    itemTitle: itemTitle || null,
    color: getParamValue(payload, "color") || (firstItem ? getParamValue(firstItem, "color") : "") || null,
    size: getParamValue(payload, "size") || (firstItem ? getParamValue(firstItem, "size") : "") || null,
    quantity: Math.max(1, Math.round(getNumber(payload, ["quantity", "count"]) ?? (firstItem ? getNumber(firstItem, ["quantity", "count"]) : null) ?? 1)),
    price: Math.max(0, Math.round(getNumber(payload, ["price", "amount", "total_price", "totalPrice"]) ?? (firstItem ? getNumber(firstItem, ["price", "amount"]) : null) ?? 0)),
    status: getString(payload, ["status", "state"]) || "NEW",
    deliveryText: normalizeDelivery(payload),
    avitoCreatedAt: getDate(payload, ["created_at", "createdAt", "date", "ordered_at", "orderedAt"]),
    rawJson: JSON.stringify(payload),
  };
}

function normalizeDelivery(payload: JsonObject) {
  const delivery = getPath(payload, "delivery") || getPath(payload, "shipment") || getPath(payload, "shipping");
  if (!delivery) return null;
  if (typeof delivery === "string") return delivery;
  if (!isObject(delivery)) return null;
  const parts = [
    getString(delivery, ["type", "method"]),
    getString(delivery, ["address", "address_line"]),
    getString(delivery, ["city"]),
    getString(delivery, ["status"]),
  ].filter(Boolean);
  return parts.length ? parts.join(", ") : JSON.stringify(delivery);
}

function getParamValue(payload: JsonObject, name: "color" | "size") {
  const directKeys = name === "color" ? ["color", "colour", "Цвет"] : ["size", "Размер"];
  const direct = getString(payload, directKeys);
  if (direct) return direct;
  const params = getPath(payload, "params") || getPath(payload, "parameters") || getPath(payload, "properties");
  if (isObject(params)) {
    for (const key of Object.keys(params)) {
      if (normalizeComparable(key).includes(name)) {
        const value = params[key];
        if (typeof value === "string" || typeof value === "number") return String(value).trim();
      }
    }
  }
  if (Array.isArray(params)) {
    for (const item of params) {
      if (!isObject(item)) continue;
      const key = getString(item, ["name", "key", "label", "tag"]).toLowerCase();
      if (key.includes(name) || (name === "color" && key.includes("цвет")) || (name === "size" && key.includes("размер"))) {
        return getString(item, ["value", "text"]);
      }
    }
  }
  return "";
}

async function markOrdersError(message: string, status: string, disable = false) {
  await prisma.automationState.upsert({
    where: { id: "default" },
    create: { id: "default", status, lastError: message, ordersEnabled: !disable },
    update: { status, lastError: message, ...(disable ? { ordersEnabled: false } : {}) },
  });
  await recordAutomationEvent("orders_sync", "ERROR", message);
  return getAutomationState();
}

function statusToDates(status?: string) {
  const now = new Date();
  if (status === "COPIED") return { copiedAt: now };
  if (status === "CONTACTED") return { contactedAt: now };
  if (status === "DONE") return { doneAt: now };
  return {};
}

function extractArray(payload: unknown, keys: string[]): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (!isObject(payload)) return [];
  for (const key of keys) {
    const value = payload[key];
    if (Array.isArray(value)) return value;
    if (isObject(value)) {
      const nested = extractArray(value, keys);
      if (nested.length) return nested;
    }
  }
  return [];
}

function firstObject(payload: JsonObject, keys: string[]) {
  for (const key of keys) {
    const value = payload[key];
    if (Array.isArray(value) && isObject(value[0])) return value[0];
  }
  return null;
}

function normalizeMessage(value: string) {
  return value.replace(/\s+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, 1500);
}

function normalizeComparable(value?: string | null) {
  return String(value ?? "").trim().toLowerCase();
}

function readableAvitoError(error: unknown): string {
  if (error instanceof AvitoApiError) return explainAvitoError(error);
  return error instanceof Error ? error.message : "Unknown Avito API error";
}

function isObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getString(payload: JsonObject, keys: string[]) {
  for (const key of keys) {
    const value = getPath(payload, key);
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return "";
}

function getNestedString(payload: JsonObject, path: string[]) {
  const value = getPath(payload, path.join("."));
  return typeof value === "string" ? value.trim() : typeof value === "number" ? String(value) : "";
}

function getNumber(payload: JsonObject, keys: string[]) {
  for (const key of keys) {
    const value = getPath(payload, key);
    if (typeof value === "number") return value;
    if (typeof value === "string" && Number.isFinite(Number(value))) return Number(value);
  }
  return null;
}

function getDate(payload: JsonObject, keys: string[]) {
  for (const key of keys) {
    const value = getPath(payload, key);
    if (typeof value !== "string" && typeof value !== "number") continue;
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date;
  }
  return null;
}

function getPath(payload: JsonObject, path: string) {
  let value: unknown = payload;
  for (const part of path.split(".")) {
    if (!isObject(value) && !Array.isArray(value)) return undefined;
    value = Array.isArray(value) ? value[Number(part)] : value[part];
  }
  return value;
}

type NormalizedOrder = {
  avitoOrderId: string;
  avitoItemId: string | null;
  externalId: string;
  sku: string;
  avitoChatId: string | null;
  buyerName: string | null;
  buyerPhone: string | null;
  itemTitle: string | null;
  color: string | null;
  size: string | null;
  quantity: number;
  price: number;
  status: string;
  deliveryText: string | null;
  avitoCreatedAt: Date | null;
  rawJson: string;
};

type MatchedOrderTarget = {
  productId: string | null;
  variantId: string | null;
  supplierId: string | null;
  productTitle: string | null;
  brand: string | null;
  color: string | null;
  size: string | null;
};

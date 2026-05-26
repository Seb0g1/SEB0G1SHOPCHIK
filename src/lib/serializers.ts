import type { ClientAvitoSettings, ClientCustomerOrder, ClientProduct, ClientSupplier, ClientSupplierTask } from "@/lib/client-types";
import { DEFAULT_COMPANY_EMAIL, DEFAULT_COMPANY_NAME } from "@/lib/defaults";

type ProductRecord = {
  id: string;
  title: string;
  brand: string | null;
  supplierId: string | null;
  supplier?: SupplierRecord | null;
  category: string;
  goodsType: string;
  productType: string;
  adType: string;
  gender: string;
  condition: string;
  basePrice: number;
  description: string;
  generatedDescription: string | null;
  avitoCategorySlug: string | null;
  avitoCategoryName: string | null;
  avitoFieldsJson: string;
  publicationErrorsJson: string;
  lastApiSyncAt: Date | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  variants: Array<{
    id: string;
    productId: string;
    color: string;
    size: string;
    sku: string;
    price: number;
    stockQty: number;
    avitoFieldsJson: string;
    needsSync: boolean;
    avitoExternalId: string | null;
    publicationStatus: string;
    lastPriceSyncAt: Date | null;
    lastStockSyncAt: Date | null;
    sortOrder: number;
  }>;
  colorGroups: Array<{
    id: string;
    productId: string;
    supplierId: string | null;
    color: string;
    avitoColorValue: string | null;
    basePrice: number;
    defaultStockQty: number;
    description: string;
    avitoFieldsJson: string;
    sortOrder: number;
    createdAt: Date;
    updatedAt: Date;
  }>;
  photos: Array<{
    id: string;
    productId: string;
    originalName: string;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    color: string | null;
    sortOrder: number;
    publicUrl: string;
    createdAt: Date;
  }>;
  publicationRuns: Array<{
    id: string;
    productId: string | null;
    feedVersion: string;
    status: string;
    submittedAt: Date;
    reportStatus: string | null;
    errorsJson: string;
    warningsJson: string;
    rawReport: string | null;
  }>;
};

type SupplierRecord = {
  id: string;
  name: string;
  contactName: string | null;
  phone: string | null;
  whatsapp: string | null;
  telegram: string | null;
  website: string | null;
  notes: string;
  defaultMessageTemplate: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export function toClientProduct(product: ProductRecord): ClientProduct {
  return {
    ...product,
    supplier: product.supplier ? toClientSupplier(product.supplier) : null,
    avitoFields: parseJsonObject(product.avitoFieldsJson),
    publicationErrors: parseJsonList(product.publicationErrorsJson),
    lastApiSyncAt: product.lastApiSyncAt?.toISOString() ?? null,
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
    variants: product.variants.map((variant) => ({
      ...variant,
      avitoFields: parseJsonObject(variant.avitoFieldsJson),
      lastPriceSyncAt: variant.lastPriceSyncAt?.toISOString() ?? null,
      lastStockSyncAt: variant.lastStockSyncAt?.toISOString() ?? null,
    })),
    colorGroups: product.colorGroups.map((group) => ({
      ...group,
      avitoFields: parseJsonObject(group.avitoFieldsJson),
      createdAt: group.createdAt.toISOString(),
      updatedAt: group.updatedAt.toISOString(),
    })),
    photos: product.photos.map((photo) => ({
      ...photo,
      createdAt: photo.createdAt.toISOString(),
    })),
    publicationRuns: product.publicationRuns.map((run) => ({
      id: run.id,
      productId: run.productId,
      feedVersion: run.feedVersion,
      status: run.status,
      submittedAt: run.submittedAt.toISOString(),
      reportStatus: run.reportStatus,
      errors: parseJsonList(run.errorsJson),
      warnings: parseJsonList(run.warningsJson),
      rawReport: run.rawReport,
    })),
  };
}

export function toClientSupplier(supplier: SupplierRecord): ClientSupplier {
  return {
    ...supplier,
    createdAt: supplier.createdAt.toISOString(),
    updatedAt: supplier.updatedAt.toISOString(),
  };
}

export function toClientSupplierTask(
  task: {
    id: string;
    orderId: string;
    supplierId: string | null;
    generatedMessage: string;
    status: string;
    notes: string;
    copiedAt: Date | null;
    contactedAt: Date | null;
    doneAt: Date | null;
    error: string | null;
    createdAt: Date;
    updatedAt: Date;
    supplier?: SupplierRecord | null;
  },
): ClientSupplierTask {
  return {
    id: task.id,
    orderId: task.orderId,
    supplierId: task.supplierId,
    generatedMessage: task.generatedMessage,
    status: task.status,
    notes: task.notes,
    copiedAt: task.copiedAt?.toISOString() ?? null,
    contactedAt: task.contactedAt?.toISOString() ?? null,
    doneAt: task.doneAt?.toISOString() ?? null,
    error: task.error,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
    supplier: task.supplier ? toClientSupplier(task.supplier) : null,
  };
}

export function toClientCustomerOrder(order: {
  id: string;
  avitoOrderId: string;
  avitoItemId: string | null;
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
  productId: string | null;
  variantId: string | null;
  avitoCreatedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  product?: { id: string; title: string; brand: string | null } | null;
  variant?: { id: string; sku: string; color: string; size: string; price: number } | null;
  supplierTask?: (Parameters<typeof toClientSupplierTask>[0] & { supplier?: SupplierRecord | null }) | null;
}): ClientCustomerOrder {
  return {
    id: order.id,
    avitoOrderId: order.avitoOrderId,
    avitoItemId: order.avitoItemId,
    avitoChatId: order.avitoChatId,
    buyerName: order.buyerName,
    buyerPhone: order.buyerPhone,
    itemTitle: order.itemTitle,
    color: order.color,
    size: order.size,
    quantity: order.quantity,
    price: order.price,
    status: order.status,
    deliveryText: order.deliveryText,
    productId: order.productId,
    variantId: order.variantId,
    avitoCreatedAt: order.avitoCreatedAt?.toISOString() ?? null,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    product: order.product ?? null,
    variant: order.variant ?? null,
    supplierTask: order.supplierTask ? toClientSupplierTask(order.supplierTask) : null,
  };
}

export function toClientSettings(settings: {
  clientId: string | null;
  clientSecretEncrypted: string | null;
  accessTokenEncrypted?: string | null;
  refreshTokenEncrypted?: string | null;
  tokenExpiresAt?: Date | null;
  avitoUserId?: string | null;
  sellerLocation: string | null;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  publicFeedUrl: string | null;
  redirectUrl: string | null;
  autoloadReportEmail?: string | null;
  autoloadScheduleJson?: string | null;
  capabilitiesJson?: string | null;
  updatedAt?: Date | null;
} | null): ClientAvitoSettings {
  const envClientId = process.env.AVITO_CLIENT_ID ?? "";
  const envSecret = process.env.AVITO_CLIENT_SECRET ?? "";

  return {
    clientId: settings?.clientId ?? envClientId,
    hasClientSecret: Boolean(settings?.clientSecretEncrypted),
    secretStatus: settings?.clientSecretEncrypted ? "ok" : envSecret ? "env" : "empty",
    clientIdSource: settings?.clientId ? "database" : envClientId ? "env" : "empty",
    secretSource: settings?.clientSecretEncrypted ? "database" : envSecret ? "env" : "empty",
    oauthConnected: Boolean(settings?.accessTokenEncrypted || settings?.refreshTokenEncrypted),
    oauthExpiresAt: settings?.tokenExpiresAt?.toISOString() ?? null,
    sellerLocation: settings?.sellerLocation ?? "Москва",
    contactName: settings?.contactName ?? DEFAULT_COMPANY_NAME,
    phone: settings?.phone ?? "",
    email: settings?.email ?? DEFAULT_COMPANY_EMAIL,
    address: settings?.address ?? "Москва",
    publicFeedUrl: settings?.publicFeedUrl ?? defaultFeedUrl(),
    redirectUrl: resolveRedirectUrl(settings?.redirectUrl),
    avitoUserId: settings?.avitoUserId ?? process.env.AVITO_ACCOUNT_ID ?? "self",
    autoloadReportEmail: settings?.autoloadReportEmail ?? settings?.email ?? DEFAULT_COMPANY_EMAIL,
    autoloadScheduleJson: settings?.autoloadScheduleJson ?? "[]",
    capabilities: parseUnknownJsonObject(settings?.capabilitiesJson ?? "{}"),
    updatedAt: settings?.updatedAt?.toISOString() ?? null,
  };
}

export function parseJsonList(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export function parseJsonObject(value: string): Record<string, string> {
  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed).map(([key, item]) => [key, item === null || item === undefined ? "" : String(item)]),
    );
  } catch {
    return {};
  }
}

export function parseUnknownJsonObject(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export function defaultFeedUrl(): string {
  const baseUrl = process.env.APP_PUBLIC_URL || "http://localhost:4317";
  return `${baseUrl.replace(/\/$/, "")}/api/avito/feed.xml`;
}

export function defaultRedirectUrl(): string {
  const baseUrl = process.env.APP_PUBLIC_URL || "http://localhost:4317";
  return process.env.AVITO_REDIRECT_URL || `${baseUrl.replace(/\/$/, "")}/`;
}

export function resolveRedirectUrl(storedUrl?: string | null): string {
  const envUrl = process.env.AVITO_REDIRECT_URL?.trim();
  if (envUrl) return envUrl;

  const value = storedUrl?.trim();
  if (value && !value.endsWith("/api/avito/oauth/callback")) return value;

  return defaultRedirectUrl();
}

import { prisma } from "@/lib/prisma";
import { getRawAvitoSettings } from "@/lib/settings";
import { AvitoClient } from "@/lib/avito/client";

export type AvitoCategoryNode = {
  name: string;
  slug: string;
  path: string;
  children: AvitoCategoryNode[];
};

export type AvitoCatalogField = {
  key: string;
  label: string;
  type: "string" | "number" | "select" | "boolean" | "text";
  required: boolean;
  values: string[];
  valuesLinkJson?: string;
  help?: string;
};

export type CatalogResult<T> = {
  data: T;
  source: "api" | "cache" | "fallback";
  warning?: string;
};

const CACHE_TTL_MS = 12 * 60 * 60 * 1000;

const fallbackTree: AvitoCategoryNode[] = [
  {
    name: "Личные вещи",
    slug: "lichnye-veshchi",
    path: "Личные вещи",
    children: [
      {
        name: "Одежда, обувь, аксессуары",
        slug: "odezhda-obuv-aksessuary",
        path: "Личные вещи / Одежда, обувь, аксессуары",
        children: [
          {
            name: "Футболки и топы",
            slug: "futbolki-i-topy",
            path: "Личные вещи / Одежда, обувь, аксессуары / Футболки и топы",
            children: [],
          },
          {
            name: "Кроссовки и кеды",
            slug: "krossovki-i-kedy",
            path: "Личные вещи / Одежда, обувь, аксессуары / Кроссовки и кеды",
            children: [],
          },
        ],
      },
    ],
  },
];

const fallbackFields: AvitoCatalogField[] = [
  { key: "Brand", label: "Бренд", type: "string", required: true, values: [] },
  { key: "Condition", label: "Состояние", type: "select", required: true, values: ["Новое", "Б/у"] },
  { key: "Gender", label: "Пол", type: "select", required: true, values: ["Мужская", "Женская", "Унисекс"] },
  { key: "Color", label: "Цвет", type: "string", required: true, values: [] },
  { key: "Size", label: "Размер", type: "string", required: true, values: [] },
  { key: "Material", label: "Материал", type: "string", required: false, values: [] },
];

export async function getCatalogTree(): Promise<CatalogResult<AvitoCategoryNode[]>> {
  return getCachedOrFetch("catalog:tree", fallbackTree, async (client) => normalizeTree(await client.getCatalogTree()));
}

export async function getCatalogFields(slug: string): Promise<CatalogResult<AvitoCatalogField[]>> {
  const fallback = fallbackFields;
  return getCachedOrFetch(`catalog:fields:${slug}`, fallback, async (client) =>
    normalizeFields(await client.getNodeFields(slug)),
  );
}

export async function getFieldValues(url: string): Promise<CatalogResult<string[]>> {
  const fallback: string[] = [];
  return getCachedOrFetch(`catalog:values:${url}`, fallback, async (client) => normalizeValues(await client.requestUrl(url)));
}

async function getCachedOrFetch<T>(
  key: string,
  fallback: T,
  fetcher: (client: AvitoClient) => Promise<T>,
): Promise<CatalogResult<T>> {
  const cached = await readCache<T>(key);
  if (cached && cached.expiresAt > Date.now()) {
    return { data: cached.data, source: "cache" };
  }

  const settings = await getRawAvitoSettings();
  if (!settings.clientId || !settings.clientSecret) {
    return cached
      ? { data: cached.data, source: "cache", warning: "Avito API keys are not configured." }
      : { data: fallback, source: "fallback", warning: "Avito API keys are not configured." };
  }

  try {
    const client = new AvitoClient({ clientId: settings.clientId, clientSecret: settings.clientSecret });
    const data = await fetcher(client);
    await writeCache(key, data);
    return { data, source: "api" };
  } catch (error) {
    const warning = error instanceof Error ? error.message : "Avito catalog request failed.";
    return cached ? { data: cached.data, source: "cache", warning } : { data: fallback, source: "fallback", warning };
  }
}

async function readCache<T>(key: string): Promise<{ data: T; expiresAt: number } | null> {
  const item = await prisma.avitoCatalogCache.findUnique({ where: { key } });
  if (!item) return null;
  try {
    return {
      data: JSON.parse(item.dataJson) as T,
      expiresAt: item.expiresAt.getTime(),
    };
  } catch {
    return null;
  }
}

async function writeCache(key: string, data: unknown) {
  await prisma.avitoCatalogCache.upsert({
    where: { key },
    create: {
      key,
      dataJson: JSON.stringify(data),
      expiresAt: new Date(Date.now() + CACHE_TTL_MS),
    },
    update: {
      dataJson: JSON.stringify(data),
      expiresAt: new Date(Date.now() + CACHE_TTL_MS),
    },
  });
}

export function normalizeTree(payload: unknown): AvitoCategoryNode[] {
  return unwrapNodes(payload).map((node) => normalizeNode(node, "")).filter(Boolean) as AvitoCategoryNode[];
}

function unwrapNodes(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];
  const record = payload as Record<string, unknown>;
  for (const key of ["nodes", "tree", "items", "categories", "children", "data", "result"]) {
    if (Array.isArray(record[key])) return record[key] as unknown[];
  }
  return [payload];
}

function normalizeNode(payload: unknown, parentPath: string): AvitoCategoryNode | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  const name = stringValue(record.name ?? record.title ?? record.label ?? record.node_name ?? record.category_name);
  const slug = stringValue(record.slug ?? record.node_slug ?? record.code ?? record.id ?? record.name);
  if (!name || !slug) return null;
  const path = parentPath ? `${parentPath} / ${name}` : name;
  const children = unwrapNodes(record.children ?? record.nodes ?? record.items ?? record.categories)
    .map((item) => normalizeNode(item, path))
    .filter(Boolean) as AvitoCategoryNode[];
  return { name, slug, path, children };
}

export function normalizeFields(payload: unknown): AvitoCatalogField[] {
  const fields = Array.isArray(payload)
    ? payload
    : payload && typeof payload === "object"
      ? unwrapNodes((payload as Record<string, unknown>).fields ?? (payload as Record<string, unknown>).items ?? payload)
      : [];
  return fields.map(normalizeField).filter(Boolean) as AvitoCatalogField[];
}

function normalizeField(payload: unknown): AvitoCatalogField | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  const key = stringValue(record.slug ?? record.name ?? record.id ?? record.code ?? record.xml_name ?? record.field);
  const label = stringValue(record.title ?? record.label ?? record.name ?? record.description ?? key);
  if (!key || !label) return null;
  const values = normalizeValues(record.values ?? record.options ?? record.variants ?? record.enum);
  const rawType = stringValue(record.type ?? record.field_type ?? record.data_type).toLowerCase();
  const type = values.length
    ? "select"
    : rawType.includes("number") || rawType.includes("int")
      ? "number"
      : rawType.includes("bool")
        ? "boolean"
        : rawType.includes("text")
          ? "text"
          : "string";
  return {
    key,
    label,
    type,
    required: Boolean(record.required ?? record.is_required ?? record.isRequired),
    values,
    valuesLinkJson: stringValue(record.values_link_json ?? record.valuesLinkJson) || undefined,
    help: stringValue(record.help ?? record.hint ?? record.description) || undefined,
  };
}

export function normalizeValues(payload: unknown): string[] {
  if (!payload) return [];
  if (Array.isArray(payload)) {
    return payload
      .map((item) =>
        typeof item === "object" && item
          ? stringValue((item as Record<string, unknown>).name ?? (item as Record<string, unknown>).title ?? item)
          : stringValue(item),
      )
      .filter(Boolean);
  }
  if (typeof payload === "object") {
    return Object.values(payload).map(stringValue).filter(Boolean);
  }
  return [];
}

function stringValue(value: unknown): string {
  return value === null || value === undefined ? "" : String(value).trim();
}

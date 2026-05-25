import type { ClientAvitoSettings, ClientProduct } from "@/lib/client-types";

type ProductRecord = {
  id: string;
  title: string;
  brand: string | null;
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
    avitoExternalId: string | null;
    publicationStatus: string;
    sortOrder: number;
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

export function toClientProduct(product: ProductRecord): ClientProduct {
  return {
    ...product,
    avitoFields: parseJsonObject(product.avitoFieldsJson),
    publicationErrors: parseJsonList(product.publicationErrorsJson),
    lastApiSyncAt: product.lastApiSyncAt?.toISOString() ?? null,
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
    variants: product.variants.map((variant) => ({ ...variant })),
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

export function toClientSettings(settings: {
  clientId: string | null;
  clientSecretEncrypted: string | null;
  sellerLocation: string | null;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  publicFeedUrl: string | null;
  redirectUrl: string | null;
} | null): ClientAvitoSettings {
  return {
    clientId: settings?.clientId ?? "",
    hasClientSecret: Boolean(settings?.clientSecretEncrypted),
    sellerLocation: settings?.sellerLocation ?? "Москва",
    contactName: settings?.contactName ?? "",
    phone: settings?.phone ?? "",
    email: settings?.email ?? "",
    address: settings?.address ?? "Москва",
    publicFeedUrl: settings?.publicFeedUrl ?? defaultFeedUrl(),
    redirectUrl: settings?.redirectUrl ?? defaultRedirectUrl(),
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

export function defaultFeedUrl(): string {
  const baseUrl = process.env.APP_PUBLIC_URL || "http://localhost:4317";
  return `${baseUrl.replace(/\/$/, "")}/api/avito/feed.xml`;
}

export function defaultRedirectUrl(): string {
  const baseUrl = process.env.APP_PUBLIC_URL || "http://localhost:4317";
  return process.env.AVITO_REDIRECT_URL || `${baseUrl.replace(/\/$/, "")}/api/avito/oauth/callback`;
}

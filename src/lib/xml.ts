import { activeForFeed } from "@/lib/variants";
import { displayVariantSize } from "@/lib/avito/field-utils";

type FeedSettings = {
  address: string;
  publicFeedUrl: string;
};

type FeedProduct = {
  id: string;
  title: string;
  brand: string | null;
  category: string;
  goodsType: string;
  productType: string;
  adType: string;
  gender: string;
  condition: string;
  generatedDescription: string | null;
  description: string;
  avitoCategoryName?: string | null;
  avitoFieldsJson?: string;
  colorGroups?: Array<{
    color: string;
    avitoColorValue: string | null;
    description: string;
    avitoFieldsJson: string;
  }>;
  variants: Array<{
    id: string;
    color: string;
    size: string;
    sku: string;
    price: number;
    stockQty: number;
    avitoFieldsJson?: string;
    publicationStatus: string;
  }>;
  photos: Array<{
    color: string | null;
    publicUrl: string;
    sortOrder: number;
  }>;
};

export function escapeXml(value: string | number | null | undefined): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function cdata(value: string): string {
  return `<![CDATA[${value.replaceAll("]]>", "]]]]><![CDATA[>")}]]>`;
}

export function absolutePublicUrl(pathOrUrl: string, baseUrl = process.env.APP_PUBLIC_URL || "http://localhost:4317") {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  return `${baseUrl.replace(/\/$/, "")}${pathOrUrl.startsWith("/") ? "" : "/"}${pathOrUrl}`;
}

export function buildVariantDescription(product: FeedProduct, variant: FeedProduct["variants"][number]): string {
  const group = product.colorGroups?.find((item) => item.color === variant.color || item.avitoColorValue === variant.color);
  const base = group?.description || product.generatedDescription || product.description || "";
  return [
    base.trim(),
    "",
    `Цвет: ${variant.color}`,
    variant.size === "ONE_SIZE" ? "" : `Размер: ${displayVariantSize(variant.size)}`,
    `Артикул: ${variant.sku}`,
    `Остаток: ${variant.stockQty}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildAvitoFeed(products: FeedProduct[], settings: FeedSettings): string {
  const baseUrl = feedBaseUrl(settings.publicFeedUrl);
  const ads = products.flatMap((product) =>
    product.variants.filter(activeForFeed).map((variant) => {
      const photos = product.photos
        .filter((photo) => !photo.color || photo.color === variant.color)
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((photo) => absolutePublicUrl(photo.publicUrl, baseUrl));

      const imageXml = photos.length
        ? `      <Images>\n${photos.map((url) => `        <Image url="${escapeXml(url)}" />`).join("\n")}\n      </Images>\n`
        : "";

      const title = `${product.title} (${variant.color})`;
      const description = buildVariantDescription(product, variant);
      const dynamicFields = buildDynamicFieldXml(product, variant);
      const fallbackFields = dynamicFields.trim() ? "" : buildLegacyFieldXml(product, variant);
      const hasSizeField = dynamicFields.includes("<Size>") || fallbackFields.includes("<Size>");
      const hasColorField = dynamicFields.includes("<Color>") || fallbackFields.includes("<Color>");

      return `    <Ad>
      <Id>${escapeXml(variant.sku)}</Id>
      <AdType>${escapeXml(product.adType)}</AdType>
      <Title>${escapeXml(title)}</Title>
      <Description>${cdata(description)}</Description>
      <Price>${escapeXml(variant.price)}</Price>
      <Address>${escapeXml(settings.address || "Москва")}</Address>
${dynamicFields || fallbackFields}      ${hasColorField ? "" : `<Color>${escapeXml(variant.color)}</Color>`}
      ${variant.size === "ONE_SIZE" || hasSizeField ? "" : `<Size>${escapeXml(variant.size)}</Size>`}
      <Quantity>${escapeXml(variant.stockQty)}</Quantity>
${imageXml}    </Ad>`;
    }),
  );

  return `<?xml version="1.0" encoding="UTF-8"?>
<Ads formatVersion="3" target="Avito.ru">
${ads.join("\n")}
</Ads>
`;
}

export function validateProductForFeed(product: FeedProduct): string[] {
  const errors: string[] = [];
  if (!product.title.trim()) errors.push("Название товара обязательно.");
  if (!product.variants.some(activeForFeed)) errors.push("Нет активных вариантов с остатком больше нуля.");
  if (!product.photos.length) errors.push("Нет фото: Avito обычно требует изображения товара.");
  for (const variant of product.variants.filter(activeForFeed)) {
    if (!variant.color.trim()) errors.push(`У варианта ${variant.sku} не указан цвет.`);
    if (!variant.size.trim()) errors.push(`У варианта ${variant.sku} не указан размер.`);
    if (variant.price <= 0) errors.push(`У варианта ${variant.sku} цена должна быть больше нуля.`);
  }
  return [...new Set(errors)];
}

function buildDynamicFieldXml(product: FeedProduct, variant: FeedProduct["variants"][number]): string {
  const group = product.colorGroups?.find((item) => item.color === variant.color || item.avitoColorValue === variant.color);
  const fields = {
    ...parseRecord(product.avitoFieldsJson),
    ...parseRecord(group?.avitoFieldsJson),
    ...parseRecord(variant.avitoFieldsJson),
  };

  if (product.avitoCategoryName && !fields.Category) {
    fields.Category = product.avitoCategoryName.split("/").at(-1)?.trim() || product.avitoCategoryName;
  }
  if (product.brand && !fields.Brand) fields.Brand = product.brand;
  if (!fields.Color) fields.Color = variant.color;
  if (variant.size !== "ONE_SIZE" && !fields.Size) fields.Size = variant.size;

  const skip = new Set(["Id", "Title", "Description", "Price", "Address", "Images", "Image", "Quantity"]);
  return Object.entries(fields)
    .filter(([key, value]) => key && !skip.has(key) && String(value ?? "").trim())
    .map(([key, value]) => {
      const tag = safeTagName(key);
      return tag ? `      <${tag}>${escapeXml(value)}</${tag}>` : "";
    })
    .filter(Boolean)
    .join("\n")
    .concat(Object.keys(fields).length ? "\n" : "");
}

function buildLegacyFieldXml(product: FeedProduct, variant: FeedProduct["variants"][number]) {
  return `      <Category>${escapeXml(product.category)}</Category>
      <GoodsType>${escapeXml(product.goodsType)}</GoodsType>
      <ProductType>${escapeXml(product.productType)}</ProductType>
      <Condition>${escapeXml(product.condition)}</Condition>
      <Gender>${escapeXml(product.gender)}</Gender>
      ${product.brand ? `<Brand>${escapeXml(product.brand)}</Brand>` : ""}
      <Color>${escapeXml(variant.color)}</Color>
      ${variant.size === "ONE_SIZE" ? "" : `<Size>${escapeXml(variant.size)}</Size>`}
`;
}

function parseRecord(value?: string): Record<string, string> {
  try {
    const parsed = JSON.parse(value || "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed).map(([key, item]) => [key, item === null || item === undefined ? "" : String(item)]),
    );
  } catch {
    return {};
  }
}

function safeTagName(value: string) {
  return value.replace(/[^A-Za-z0-9_:-]/g, "");
}

function feedBaseUrl(feedUrl: string): string {
  try {
    return new URL(feedUrl).origin;
  } catch {
    return process.env.APP_PUBLIC_URL || "http://localhost:4317";
  }
}

import path from "node:path";
import fs from "node:fs/promises";
import JSZip from "jszip";
import { displayVariantSize } from "@/lib/avito/field-utils";
import { activeForFeed } from "@/lib/variants";
import { absolutePublicUrl } from "@/lib/xml";

export type AvitoExcelSettings = {
  phone?: string | null;
  address?: string | null;
  email?: string | null;
  contactName?: string | null;
  publicFeedUrl?: string | null;
};

export type AvitoExcelProduct = {
  id: string;
  title: string;
  brand: string | null;
  condition: string;
  description: string;
  generatedDescription: string | null;
  avitoFieldsJson?: string;
  colorGroups?: Array<{
    color: string;
    avitoColorValue: string | null;
    description: string;
    avitoFieldsJson: string;
    sortOrder?: number;
  }>;
  variants: Array<{
    id: string;
    color: string;
    size: string;
    sku: string;
    price: number;
    stockQty: number;
    avitoExternalId: string | null;
    publicationStatus: string;
    avitoFieldsJson?: string;
    sortOrder?: number;
  }>;
  photos: Array<{
    color: string | null;
    publicUrl: string;
    sortOrder: number;
  }>;
};

export type AvitoExcelRow = {
  id: string;
  placement: string;
  avitoId: string;
  phone: string;
  address: string;
  imageUrls: string;
  contactMethod: string;
  title: string;
  description: string;
  category: string;
  price: number;
  clothingType: string;
  condition: string;
  adType: string;
  brand: string;
  color: string;
  manufacturerColor: string;
  material: string;
  joinAds: string;
  multiAdName: string;
  productType: string;
  size: string;
  subtype: string;
  targetAudience: string;
  dateEnd: string;
  avitoStatus: string;
  email: string;
  companyName: string;
};

const templatePath = path.join(process.cwd(), "templates", "avito-men-tshirts.xlsx");
const categorySheetName = "Мужская одежда-Кофты и футболки";
const dataStartRow = 5;
const targetOrigin = "https://amsterdam2.sebog1.ru";

const sizeMap: Record<string, string> = {
  XS: "42 (XS)",
  S: "46 (S)",
  M: "48 (M)",
  L: "50 (L)",
  XL: "54 (XL)",
  XXL: "56 (XXL)",
  "2XL": "56 (XXL)",
  "3XL": "60 (3XL)",
  ONE_SIZE: "Без размера",
};

export function buildAvitoExcelRows(products: AvitoExcelProduct[], settings: AvitoExcelSettings): AvitoExcelRow[] {
  const imageBaseUrl = imageOrigin(settings);

  return products.flatMap((product) => {
    const productFields = parseRecord(product.avitoFieldsJson);
    const sortedVariants = [...product.variants].sort(
      (a, b) => a.color.localeCompare(b.color, "ru") || (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.size.localeCompare(b.size, "ru"),
    );

    return sortedVariants.filter(activeForFeed).map((variant) => {
      const group = findColorGroup(product, variant.color);
      const groupFields = parseRecord(group?.avitoFieldsJson);
      const variantFields = parseRecord(variant.avitoFieldsJson);
      const fields = { ...productFields, ...groupFields, ...variantFields };
      const color = group?.avitoColorValue || variant.color;
      const title = `${product.title} (${color})`;
      const photos = photosForColor(product, variant.color).map((photo) => absolutePublicUrl(photo.publicUrl, imageBaseUrl));

      return {
        id: variant.sku,
        placement: "Package",
        avitoId: variant.avitoExternalId ?? "",
        phone: digitsOnly(settings.phone ?? ""),
        address: settings.address?.trim() || "Москва",
        imageUrls: photos.join(" | "),
        contactMethod: "В сообщениях",
        title,
        description: buildExcelDescription(product, variant, group),
        category: "Одежда, обувь, аксессуары",
        price: variant.price,
        clothingType: "Мужская одежда",
        condition: normalizeCondition(product.condition),
        adType: normalizeAdType(fieldValue(fields, ["AdType", "Вид объявления"]) || productFields.AdType),
        brand: product.brand?.trim() || fieldValue(fields, ["Brand", "Бренд одежды"]) || "",
        color,
        manufacturerColor: group?.color || color,
        material: fieldValue(fields, ["Material", "Материал основной части", "MainMaterial"]) || "Хлопок",
        joinAds: "Да",
        multiAdName: product.title.toLowerCase(),
        productType: "Кофты и футболки",
        size: normalizeSize(variant.size),
        subtype: fieldValue(fields, ["Subtype", "Подвид товара", "GoodsSubType"]) || "Футболка",
        targetAudience: "Частные лица и бизнес",
        dateEnd: "",
        avitoStatus: "",
        email: settings.email?.trim() || "",
        companyName: settings.contactName?.trim() || "SEB0G1SHOPCHIK",
      };
    });
  });
}

export function validateAvitoExcelExport(products: AvitoExcelProduct[], settings: AvitoExcelSettings) {
  const errors: string[] = [];
  const warnings: string[] = [];
  const rows = buildAvitoExcelRows(products, settings);
  const origin = imageOrigin(settings);

  if (!products.length) errors.push("Нет товаров для выгрузки.");
  if (!rows.length) errors.push("Нет активных вариантов с остатком больше 0.");
  if (!settings.phone?.trim()) warnings.push("В настройках не заполнен телефон: колонка Номер телефона будет пустой.");
  if (!settings.address?.trim()) warnings.push("В настройках не заполнен адрес: будет использована Москва.");
  if (!settings.email?.trim()) warnings.push("В настройках не заполнена почта: колонка Почта будет пустой.");
  if (origin !== targetOrigin) {
    warnings.push(`Публичный домен для фото сейчас ${origin}. Для Avito лучше использовать ${targetOrigin}.`);
  }

  for (const product of products) {
    const activeVariants = product.variants.filter(activeForFeed);
    if (!activeVariants.length) continue;
    if (!product.title.trim()) errors.push(`У товара ${product.id} не заполнено название.`);
    for (const variant of activeVariants) {
      const photos = photosForColor(product, variant.color);
      if (!photos.length) errors.push(`У варианта ${variant.sku} нет фото для Excel.`);
      if (variant.price <= 0) errors.push(`У варианта ${variant.sku} цена должна быть больше 0.`);
      if (!variant.sku.trim()) errors.push(`У варианта ${variant.id} нет SKU.`);
    }
  }

  return {
    errors: [...new Set(errors)],
    warnings: [...new Set(warnings)],
    rowCount: rows.length,
    imageOrigin: origin,
  };
}

export async function generateAvitoExcel(products: AvitoExcelProduct[], settings: AvitoExcelSettings) {
  const validation = validateAvitoExcelExport(products, settings);
  if (validation.errors.length) {
    throw new Error(validation.errors.join("\n"));
  }

  const template = await fs.readFile(templatePath);
  const zip = await JSZip.loadAsync(template);
  const sheetFile = zip.file("xl/worksheets/sheet2.xml");
  const sharedStringsFile = zip.file("xl/sharedStrings.xml");
  if (!sheetFile) throw new Error(`Лист шаблона не найден: ${categorySheetName}`);
  if (!sharedStringsFile) throw new Error("В шаблоне Avito не найден sharedStrings.xml.");

  const [sheetXml, sharedStringsXml] = await Promise.all([sheetFile.async("string"), sharedStringsFile.async("string")]);
  const sharedStrings = createSharedStringWriter(sharedStringsXml);
  const rows = buildAvitoExcelRows(products, settings);
  const updatedSheetXml = replaceDataRows(sheetXml, rows, sharedStrings);
  zip.file("xl/worksheets/sheet2.xml", updatedSheetXml);
  zip.file("xl/sharedStrings.xml", sharedStrings.toXml());

  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

export function normalizeSize(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "Без размера";
  if (/^\d+\s*\([^)]+\)$/i.test(trimmed)) return trimmed;
  return sizeMap[trimmed.toUpperCase()] || displayVariantSize(trimmed);
}

export function sanitizeAvitoHtml(value: string) {
  return value
    .replace(/<\s*(script|style)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
    .replace(/\son\w+\s*=\s*(['"]).*?\1/gi, "")
    .replace(/\s(href|src)\s*=\s*(['"])\s*javascript:[\s\S]*?\2/gi, "")
    .replace(/<(?!\/?(p|br|strong|b|ul|ol|li)\b)[^>]+>/gi, "")
    .replace(/<b\b[^>]*>/gi, "<strong>")
    .replace(/<\/b>/gi, "</strong>")
    .trim();
}

function buildExcelDescription(
  product: AvitoExcelProduct,
  variant: AvitoExcelProduct["variants"][number],
  group?: NonNullable<AvitoExcelProduct["colorGroups"]>[number],
) {
  const base = group?.description || product.generatedDescription || product.description || "";
  const safeBase = base.includes("<") ? sanitizeAvitoHtml(base) : textToHtml(base);
  const details = [
    `<p><strong>Параметры объявления</strong></p>`,
    "<ul>",
    `<li>Цвет: ${escapeHtml(group?.avitoColorValue || variant.color)}</li>`,
    `<li>Размер: ${escapeHtml(normalizeSize(variant.size))}</li>`,
    `<li>Артикул: ${escapeHtml(variant.sku)}</li>`,
    "</ul>",
  ].join("");

  return sanitizeAvitoHtml(`${safeBase}${details}`);
}

function textToHtml(value: string) {
  const lines = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) return "<p><strong>Качественный товар в наличии.</strong></p>";
  return lines.map((line) => `<p>${escapeHtml(line)}</p>`).join("");
}

function photosForColor(product: AvitoExcelProduct, color: string) {
  const colorPhotos = product.photos.filter((photo) => photo.color === color).sort((a, b) => a.sortOrder - b.sortOrder);
  const generalPhotos = product.photos.filter((photo) => !photo.color).sort((a, b) => a.sortOrder - b.sortOrder);
  return colorPhotos.length ? colorPhotos : generalPhotos;
}

function findColorGroup(product: AvitoExcelProduct, color: string) {
  return product.colorGroups?.find((group) => group.color === color || group.avitoColorValue === color);
}

function parseRecord(value?: string): Record<string, string> {
  try {
    const parsed = JSON.parse(value || "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed).map(([key, item]) => [key, item === null || item === undefined ? "" : String(item)]));
  } catch {
    return {};
  }
}

function fieldValue(fields: Record<string, string>, keys: string[]) {
  for (const key of keys) {
    const exact = fields[key]?.trim();
    if (exact) return exact;
    const found = Object.entries(fields).find(([fieldKey, value]) => fieldKey.toLowerCase() === key.toLowerCase() && value.trim());
    if (found) return found[1].trim();
  }
  return "";
}

function normalizeCondition(value: string) {
  const trimmed = value.trim();
  if (!trimmed || trimmed === "Новое") return "Новое с биркой";
  return trimmed;
}

function normalizeAdType(value?: string) {
  return value?.trim() || "Товар приобретен на продажу";
}

function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}

function imageOrigin(settings: AvitoExcelSettings) {
  const value = settings.publicFeedUrl?.trim() || process.env.APP_PUBLIC_URL || "http://localhost:4317";
  try {
    return new URL(value).origin;
  } catch {
    return "http://localhost:4317";
  }
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function replaceDataRows(sheetXml: string, rows: AvitoExcelRow[], sharedStrings: SharedStringWriter) {
  const match = sheetXml.match(/<sheetData>([\s\S]*?)<\/sheetData>/);
  if (!match) throw new Error("В шаблоне Avito не найден блок sheetData.");

  const headerRows = [...match[1].matchAll(/<row\b[^>]*\br="(\d+)"[\s\S]*?<\/row>/g)]
    .filter((rowMatch) => Number(rowMatch[1]) < dataStartRow)
    .map((rowMatch) => rowMatch[0])
    .join("");
  const dataRows = rows.map((row, index) => rowXml(dataStartRow + index, row, sharedStrings)).join("");
  const nextSheetData = `<sheetData>${headerRows}${dataRows}</sheetData>`;
  const lastRow = Math.max(dataStartRow + rows.length - 1, 4);

  return sheetXml
    .replace(/<dimension ref="[^"]*"><\/dimension>/, `<dimension ref="A1:AB${lastRow}"></dimension>`)
    .replace(/<sheetData>[\s\S]*?<\/sheetData>/, nextSheetData);
}

function rowXml(rowNumber: number, row: AvitoExcelRow, sharedStrings: SharedStringWriter) {
  const values: Array<string | number> = [
    row.id,
    row.placement,
    row.avitoId,
    row.phone,
    row.address,
    row.imageUrls,
    row.contactMethod,
    row.title,
    row.description,
    row.category,
    row.price,
    row.clothingType,
    row.condition,
    row.adType,
    row.brand,
    row.color,
    row.manufacturerColor,
    row.material,
    row.joinAds,
    row.multiAdName,
    row.productType,
    row.size,
    row.subtype,
    row.targetAudience,
    row.dateEnd,
    row.avitoStatus,
    row.email,
    row.companyName,
  ];
  const cells = values
    .map((value, index) => cellXml(`${columnName(index + 1)}${rowNumber}`, value, sharedStrings))
    .filter(Boolean)
    .join("");
  return `<row r="${rowNumber}">${cells}</row>`;
}

function cellXml(ref: string, value: string | number, sharedStrings: SharedStringWriter) {
  if (value === "") return "";
  if (typeof value === "number") return `<c r="${ref}"><v>${value}</v></c>`;
  return `<c r="${ref}" t="s"><v>${sharedStrings.add(value)}</v></c>`;
}

function columnName(index: number) {
  let dividend = index;
  let name = "";
  while (dividend > 0) {
    const modulo = (dividend - 1) % 26;
    name = String.fromCharCode(65 + modulo) + name;
    dividend = Math.floor((dividend - modulo) / 26);
  }
  return name;
}

function escapeXmlText(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

type SharedStringWriter = {
  add(value: string): number;
  toXml(): string;
};

function createSharedStringWriter(sourceXml: string): SharedStringWriter {
  const existingCount = Number(sourceXml.match(/\bcount="(\d+)"/)?.[1] ?? 0);
  const existingUniqueCount = Number(sourceXml.match(/\buniqueCount="(\d+)"/)?.[1] ?? existingCount);
  const existingItems = sourceXml.match(/<si\b[\s\S]*?<\/si>/g) ?? [];
  const additions: string[] = [];

  return {
    add(value: string) {
      const index = existingItems.length + additions.length;
      const preserve = value !== value.trim() || /\s{2,}|\r|\n|\t/.test(value);
      additions.push(`<si><t${preserve ? ' xml:space="preserve"' : ""}>${escapeXmlText(value)}</t></si>`);
      return index;
    },
    toXml() {
      const sstOpen = sourceXml.match(/<sst\b[^>]*>/)?.[0];
      if (!sstOpen) throw new Error("Некорректный sharedStrings.xml в шаблоне Avito.");
      const nextOpen = sstOpen
        .replace(/\bcount="\d+"/, `count="${existingCount + additions.length}"`)
        .replace(/\buniqueCount="\d+"/, `uniqueCount="${existingUniqueCount + additions.length}"`);
      return sourceXml.replace(/<sst\b[^>]*>[\s\S]*<\/sst>/, `${nextOpen}${existingItems.join("")}${additions.join("")}</sst>`);
    },
  };
}

import { activeForFeed } from "@/lib/variants";
import type { AvitoCatalogField } from "@/lib/avito/catalog";

export type ValidatedProduct = {
  title: string;
  basePrice: number;
  avitoCategorySlug: string | null;
  avitoFieldsJson: string;
  variants: Array<{ sku: string; color: string; size: string; price: number; stockQty: number; publicationStatus: string }>;
  photos: Array<{ id: string }>;
};

export function validateProductForApi(product: ValidatedProduct, fields: AvitoCatalogField[] = []): string[] {
  const errors: string[] = [];
  const avitoFields = parseFields(product.avitoFieldsJson);
  const activeVariants = product.variants.filter(activeForFeed);

  if (!product.title.trim()) errors.push("Название товара обязательно.");
  if (!product.avitoCategorySlug) errors.push("Выберите категорию Авито из справочника.");
  if (!product.photos.length) errors.push("Загрузите минимум одно фото товара.");
  if (!activeVariants.length) errors.push("Добавьте хотя бы один активный вариант с остатком.");
  if (product.basePrice <= 0) errors.push("Базовая цена должна быть больше нуля.");

  for (const field of fields.filter((item) => item.required)) {
    if (!String(avitoFields[field.key] ?? "").trim()) {
      errors.push(`Заполните обязательное поле: ${field.label}.`);
    }
  }

  for (const variant of activeVariants) {
    if (!variant.color.trim()) errors.push(`У варианта ${variant.sku} не указан цвет.`);
    if (!variant.size.trim()) errors.push(`У варианта ${variant.sku} не указан размер.`);
    if (variant.price <= 0) errors.push(`У варианта ${variant.sku} цена должна быть больше нуля.`);
  }

  return [...new Set(errors)];
}

function parseFields(value: string): Record<string, string> {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? Object.fromEntries(Object.entries(parsed).map(([key, item]) => [key, String(item ?? "")]))
      : {};
  } catch {
    return {};
  }
}

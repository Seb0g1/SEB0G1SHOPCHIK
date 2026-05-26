import type { AvitoCatalogField } from "@/lib/avito/catalog";

export type AvitoFieldRole = "brand" | "color" | "size" | "condition" | "price" | "title" | "unknown";

const roleMatchers: Record<Exclude<AvitoFieldRole, "unknown">, string[]> = {
  brand: ["brand", "бренд", "марка", "manufacturer"],
  color: ["color", "colour", "цвет"],
  size: ["size", "размер", "clothes_size", "shoe_size"],
  condition: ["condition", "состояние"],
  price: ["price", "цена"],
  title: ["title", "название", "name"],
};

export function getFieldRole(field: AvitoCatalogField): AvitoFieldRole {
  const haystack = normalize(`${field.key} ${field.label}`);
  for (const [role, matchers] of Object.entries(roleMatchers)) {
    if (matchers.some((matcher) => haystack.includes(normalize(matcher)))) {
      return role as AvitoFieldRole;
    }
  }
  return "unknown";
}

export function findFieldByRole(fields: AvitoCatalogField[], role: AvitoFieldRole) {
  return fields.find((field) => getFieldRole(field) === role);
}

export function isVariantField(field: AvitoCatalogField) {
  const role = getFieldRole(field);
  return role === "color" || role === "size";
}

export function isProductCoreField(field: AvitoCatalogField) {
  const role = getFieldRole(field);
  return role === "brand" || role === "price" || role === "title";
}

export function displayVariantSize(value: string) {
  return value === "ONE_SIZE" ? "Без размера" : value;
}

function normalize(value: string) {
  return value.toLowerCase().replaceAll("ё", "е").replace(/[^a-zа-я0-9_]+/g, "");
}

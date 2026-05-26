export type VariantInput = {
  productId: string;
  title: string;
  color: string;
  size: string;
  price: number;
  stockQty: number;
  sortOrder?: number;
};

export function makeSku(title: string, color: string, size: string): string {
  const productTitle = title.includes(":") ? title.split(":").slice(1).join(":") || title : title;
  const productPart = compactSlug(productTitle, "ITEM", 18);
  const colorPart = compactSlug(color, "COLOR", 12);
  const sizePart = compactSlug(size, "SIZE", 10);
  return `AV-${productPart}-${colorPart}-${sizePart}`;
}

export function expandVariants(input: {
  productId: string;
  title: string;
  color: string;
  sizes: string[];
  price: number;
  stockQty: number;
}): VariantInput[] {
  return input.sizes
    .map((size) => size.trim())
    .filter(Boolean)
    .map((size, index) => ({
      productId: input.productId,
      title: input.title,
      color: input.color.trim(),
      size,
      price: Math.max(0, Math.round(input.price)),
      stockQty: Math.max(0, Math.round(input.stockQty)),
      sortOrder: index,
    }));
}

export function activeForFeed(variant: { stockQty: number; publicationStatus: string }): boolean {
  return variant.stockQty > 0 && variant.publicationStatus !== "SUSPENDED";
}

function compactSlug(value: string, fallback: string, maxLength: number) {
  const transliterated = transliterate(value)
    .replace(/[^a-z0-9]+/gi, "")
    .toUpperCase()
    .slice(0, maxLength);
  return transliterated || fallback;
}

function transliterate(value: string) {
  const map: Record<string, string> = {
    а: "a",
    б: "b",
    в: "v",
    г: "g",
    д: "d",
    е: "e",
    ё: "e",
    ж: "zh",
    з: "z",
    и: "i",
    й: "y",
    к: "k",
    л: "l",
    м: "m",
    н: "n",
    о: "o",
    п: "p",
    р: "r",
    с: "s",
    т: "t",
    у: "u",
    ф: "f",
    х: "h",
    ц: "c",
    ч: "ch",
    ш: "sh",
    щ: "sch",
    ъ: "",
    ы: "y",
    ь: "",
    э: "e",
    ю: "yu",
    я: "ya",
  };
  return value
    .split("")
    .map((char) => {
      const lower = char.toLowerCase();
      const next = map[lower] ?? char;
      return char === lower ? next : next.toUpperCase();
    })
    .join("");
}

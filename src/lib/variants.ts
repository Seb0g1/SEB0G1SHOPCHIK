import { createHash } from "node:crypto";

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
  const hash = createHash("sha1")
    .update(`${title}:${color}:${size}`)
    .digest("hex")
    .slice(0, 8)
    .toUpperCase();
  const sizePart = size.replace(/[^a-z0-9]/gi, "").toUpperCase() || "SIZE";
  return `AV-${hash}-${sizePart}`;
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

import { prisma } from "@/lib/prisma";
import { parseJsonList } from "@/lib/serializers";

export type BulkPriceMode = "SET" | "ADD" | "PERCENT";
export type BulkPriceRounding = "NONE" | "TO_9" | "TO_99";

export type BulkPriceInput = {
  productIds?: string[];
  colors?: string[];
  sizes?: string[];
  mode: BulkPriceMode;
  value: number;
  rounding?: BulkPriceRounding;
};

export type BulkPricePreviewItem = {
  variantId: string;
  productId: string;
  productTitle: string;
  color: string;
  size: string;
  oldPrice: number;
  newPrice: number;
  stockQty: number;
};

export async function previewBulkPrice(input: BulkPriceInput) {
  const variants = await findVariants(input);
  const items = variants.map((variant) => ({
    variantId: variant.id,
    productId: variant.productId,
    productTitle: variant.product.title,
    color: variant.color,
    size: variant.size,
    oldPrice: variant.price,
    newPrice: calculatePrice(variant.price, input.mode, input.value, input.rounding ?? "NONE"),
    stockQty: variant.stockQty,
  }));

  return {
    count: items.length,
    items,
    totalBefore: items.reduce((sum, item) => sum + item.oldPrice, 0),
    totalAfter: items.reduce((sum, item) => sum + item.newPrice, 0),
  };
}

export async function applyBulkPrice(input: BulkPriceInput) {
  const preview = await previewBulkPrice(input);
  const operation = await prisma.bulkPriceOperation.create({
    data: {
      scope: input.productIds?.length === 1 ? "PRODUCT" : "CATALOG",
      filterJson: JSON.stringify({
        productIds: input.productIds ?? [],
        colors: input.colors ?? [],
        sizes: input.sizes ?? [],
      }),
      mode: input.mode,
      value: input.value,
      rounding: input.rounding ?? "NONE",
      previewCount: preview.count,
      status: "APPLYING",
    },
  });

  const errors: string[] = [];
  let appliedCount = 0;
  for (const item of preview.items) {
    try {
      await prisma.productVariant.update({
        where: { id: item.variantId },
        data: {
          price: item.newPrice,
          needsSync: true,
          publicationStatus: item.stockQty > 0 ? "READY" : "SUSPENDED",
        },
      });
      appliedCount += 1;
    } catch (error) {
      errors.push(error instanceof Error ? error.message : `Failed to update ${item.variantId}`);
    }
  }

  const updated = await prisma.bulkPriceOperation.update({
    where: { id: operation.id },
    data: {
      appliedCount,
      errorsJson: JSON.stringify(errors),
      status: errors.length ? "FAILED" : "APPLIED",
    },
  });

  return {
    operation: {
      ...updated,
      errors: parseJsonList(updated.errorsJson),
    },
    preview,
  };
}

export function calculatePrice(
  current: number,
  mode: BulkPriceMode,
  value: number,
  rounding: BulkPriceRounding = "NONE",
): number {
  const raw =
    mode === "SET"
      ? value
      : mode === "ADD"
        ? current + value
        : current + current * (value / 100);
  return roundPrice(Math.max(0, Math.round(raw)), rounding);
}

function roundPrice(value: number, rounding: BulkPriceRounding) {
  if (rounding === "TO_9") {
    return value <= 9 ? 9 : Math.max(9, Math.floor(value / 10) * 10 + 9);
  }
  if (rounding === "TO_99") {
    return value <= 99 ? 99 : Math.max(99, Math.floor(value / 100) * 100 + 99);
  }
  return value;
}

async function findVariants(input: BulkPriceInput) {
  return prisma.productVariant.findMany({
    where: {
      ...(input.productIds?.length ? { productId: { in: input.productIds } } : {}),
      ...(input.colors?.length ? { color: { in: input.colors } } : {}),
      ...(input.sizes?.length ? { size: { in: input.sizes } } : {}),
    },
    include: { product: true },
    orderBy: [{ productId: "asc" }, { color: "asc" }, { sortOrder: "asc" }, { size: "asc" }],
  });
}

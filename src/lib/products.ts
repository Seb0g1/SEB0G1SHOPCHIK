import { prisma } from "@/lib/prisma";
import { toClientProduct } from "@/lib/serializers";
import { expandVariants, makeSku } from "@/lib/variants";

export const productInclude = {
  supplier: true,
  variants: { orderBy: [{ color: "asc" as const }, { sortOrder: "asc" as const }, { size: "asc" as const }] },
  colorGroups: { orderBy: [{ sortOrder: "asc" as const }, { color: "asc" as const }] },
  photos: { orderBy: [{ color: "asc" as const }, { sortOrder: "asc" as const }, { createdAt: "asc" as const }] },
  publicationRuns: { orderBy: { submittedAt: "desc" as const }, take: 8 },
};

export async function listProducts() {
  const products = await prisma.productTemplate.findMany({
    orderBy: { updatedAt: "desc" },
    include: productInclude,
  });
  return products.map(toClientProduct);
}

export async function getProduct(id: string) {
  const product = await prisma.productTemplate.findUnique({
    where: { id },
    include: productInclude,
  });
  return product ? toClientProduct(product) : null;
}

export async function createProduct(input: {
  title: string;
  brand?: string;
  supplierId?: string | null;
  basePrice: number;
  color?: string;
  sizes?: string[];
  stockQty?: number;
  avitoCategorySlug?: string | null;
  avitoCategoryName?: string | null;
  avitoFields?: Record<string, string>;
  colorGroups?: Array<{
    color: string;
    supplierId?: string | null;
    avitoColorValue?: string | null;
    basePrice?: number;
    defaultStockQty?: number;
    description?: string;
    avitoFields?: Record<string, string>;
    sortOrder?: number;
  }>;
}) {
  const product = await prisma.productTemplate.create({
    data: {
      title: input.title.trim(),
      brand: input.brand?.trim() || null,
      supplierId: input.supplierId?.trim() || null,
      basePrice: Math.max(0, Math.round(input.basePrice)),
      avitoCategorySlug: input.avitoCategorySlug?.trim() || null,
      avitoCategoryName: input.avitoCategoryName?.trim() || null,
      avitoFieldsJson: JSON.stringify(input.avitoFields ?? {}),
      description: "",
      status: "DRAFT",
    },
  });

  if (input.colorGroups?.length) {
    await upsertColorGroups(product.id, input.colorGroups);
  }

  if (input.sizes?.length && input.color) {
    await generateVariants(product.id, {
      title: product.title,
      color: input.color,
      sizes: input.sizes,
      price: product.basePrice,
      stockQty: input.stockQty ?? 1,
    });
  }

  return getProduct(product.id);
}

export async function updateProduct(
  id: string,
  input: {
    title?: string;
    brand?: string | null;
    supplierId?: string | null;
    category?: string;
    goodsType?: string;
    productType?: string;
    adType?: string;
    gender?: string;
    condition?: string;
    basePrice?: number;
    description?: string;
    generatedDescription?: string | null;
    avitoCategorySlug?: string | null;
    avitoCategoryName?: string | null;
    avitoFields?: Record<string, string>;
    publicationErrors?: string[];
    lastApiSyncAt?: Date | null;
    status?: string;
    variants?: Array<{
      id: string;
      color: string;
      size: string;
      price: number;
      stockQty: number;
      avitoFields?: Record<string, string>;
      needsSync?: boolean;
      publicationStatus: string;
      avitoExternalId?: string | null;
    }>;
    colorGroups?: Array<{
      id?: string;
      color: string;
      supplierId?: string | null;
      avitoColorValue?: string | null;
      basePrice: number;
      defaultStockQty: number;
      description?: string;
      avitoFields?: Record<string, string>;
      sortOrder?: number;
    }>;
  },
) {
  const data = {
    ...(input.title !== undefined ? { title: input.title.trim() } : {}),
    ...(input.brand !== undefined ? { brand: input.brand?.trim() || null } : {}),
    ...(input.supplierId !== undefined ? { supplierId: input.supplierId?.trim() || null } : {}),
    ...(input.category !== undefined ? { category: input.category.trim() } : {}),
    ...(input.goodsType !== undefined ? { goodsType: input.goodsType.trim() } : {}),
    ...(input.productType !== undefined ? { productType: input.productType.trim() } : {}),
    ...(input.adType !== undefined ? { adType: input.adType.trim() } : {}),
    ...(input.gender !== undefined ? { gender: input.gender.trim() } : {}),
    ...(input.condition !== undefined ? { condition: input.condition.trim() } : {}),
    ...(input.basePrice !== undefined ? { basePrice: Math.max(0, Math.round(input.basePrice)) } : {}),
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.generatedDescription !== undefined ? { generatedDescription: input.generatedDescription } : {}),
    ...(input.avitoCategorySlug !== undefined ? { avitoCategorySlug: input.avitoCategorySlug?.trim() || null } : {}),
    ...(input.avitoCategoryName !== undefined ? { avitoCategoryName: input.avitoCategoryName?.trim() || null } : {}),
    ...(input.avitoFields !== undefined ? { avitoFieldsJson: JSON.stringify(input.avitoFields) } : {}),
    ...(input.publicationErrors !== undefined ? { publicationErrorsJson: JSON.stringify(input.publicationErrors) } : {}),
    ...(input.lastApiSyncAt !== undefined ? { lastApiSyncAt: input.lastApiSyncAt } : {}),
    ...(input.status !== undefined ? { status: input.status } : {}),
  };

  await prisma.productTemplate.update({ where: { id }, data });

  if (input.variants) {
    for (const variant of input.variants) {
      await prisma.productVariant.update({
        where: { id: variant.id },
        data: {
          color: variant.color.trim(),
          size: variant.size.trim(),
          price: Math.max(0, Math.round(variant.price)),
          stockQty: Math.max(0, Math.round(variant.stockQty)),
          avitoFieldsJson: JSON.stringify(variant.avitoFields ?? {}),
          ...(variant.needsSync !== undefined ? { needsSync: variant.needsSync } : {}),
          publicationStatus: variant.publicationStatus,
          avitoExternalId: variant.avitoExternalId?.trim() || null,
        },
      });
    }
  }

  if (input.colorGroups) {
    await upsertColorGroups(id, input.colorGroups);
  }

  return getProduct(id);
}

export async function createBulkProduct(input: {
  title: string;
  brand?: string;
  supplierId?: string | null;
  basePrice: number;
  avitoCategorySlug?: string | null;
  avitoCategoryName?: string | null;
  avitoFields?: Record<string, string>;
  colorGroups: Array<{
    color: string;
    supplierId?: string | null;
    avitoColorValue?: string | null;
    basePrice?: number;
    defaultStockQty?: number;
    description?: string;
    avitoFields?: Record<string, string>;
    sizes: string[];
    variants?: Array<{ size: string; price: number; stockQty: number }>;
  }>;
}) {
  const product = await prisma.productTemplate.create({
    data: {
      title: input.title.trim(),
      brand: input.brand?.trim() || null,
      supplierId: input.supplierId?.trim() || null,
      basePrice: Math.max(0, Math.round(input.basePrice)),
      avitoCategorySlug: input.avitoCategorySlug?.trim() || null,
      avitoCategoryName: input.avitoCategoryName?.trim() || null,
      avitoFieldsJson: JSON.stringify(input.avitoFields ?? {}),
      description: "",
      status: "DRAFT",
    },
  });

  await upsertColorGroups(
    product.id,
    input.colorGroups.map((group, index) => ({
      color: group.color,
      supplierId: group.supplierId ?? null,
      avitoColorValue: group.avitoColorValue ?? group.color,
      basePrice: group.basePrice ?? product.basePrice,
      defaultStockQty: group.defaultStockQty ?? 1,
      description: group.description ?? "",
      avitoFields: group.avitoFields ?? {},
      sortOrder: index,
    })),
  );

  for (const group of input.colorGroups) {
    const color = group.avitoColorValue?.trim() || group.color.trim();
    const variants = group.variants?.length
      ? group.variants
      : (group.sizes.length ? group.sizes : ["ONE_SIZE"]).map((size) => ({
          size,
          price: group.basePrice ?? product.basePrice,
          stockQty: group.defaultStockQty ?? 1,
        }));
    for (const variant of variants) {
      await generateVariants(product.id, {
        title: product.title,
        color,
        sizes: [variant.size],
        price: variant.price,
        stockQty: variant.stockQty,
        variantFields: group.avitoFields ?? {},
      });
    }
  }

  return getProduct(product.id);
}

export async function generateVariants(
  productId: string,
  input: { title: string; color: string; sizes: string[]; price: number; stockQty: number; variantFields?: Record<string, string> },
) {
  const variants = expandVariants({
    productId,
    title: input.title,
    color: input.color,
    sizes: input.sizes,
    price: input.price,
    stockQty: input.stockQty,
  });

  for (const variant of variants) {
    await prisma.productVariant.upsert({
      where: {
        productId_color_size: {
          productId,
          color: variant.color,
          size: variant.size,
        },
      },
      create: {
        productId,
        color: variant.color,
        size: variant.size,
        sku: makeSku(`${productId}:${input.title}`, variant.color, variant.size),
        price: variant.price,
        stockQty: variant.stockQty,
        avitoFieldsJson: JSON.stringify(input.variantFields ?? {}),
        needsSync: true,
        sortOrder: variant.sortOrder ?? 0,
        publicationStatus: "DRAFT",
      },
      update: {
        price: variant.price,
        stockQty: variant.stockQty,
        avitoFieldsJson: JSON.stringify(input.variantFields ?? {}),
        needsSync: true,
        sortOrder: variant.sortOrder ?? 0,
        publicationStatus: "DRAFT",
      },
    });
  }

  return getProduct(productId);
}

export async function upsertColorGroups(
  productId: string,
  groups: Array<{
    id?: string;
    color: string;
    supplierId?: string | null;
    avitoColorValue?: string | null;
    basePrice?: number;
    defaultStockQty?: number;
    description?: string;
    avitoFields?: Record<string, string>;
    sortOrder?: number;
  }>,
) {
  for (const [index, group] of groups.entries()) {
    const color = group.color.trim();
    if (!color) continue;
    await prisma.productColorGroup.upsert({
      where: { productId_color: { productId, color } },
      create: {
        productId,
        supplierId: group.supplierId?.trim() || null,
        color,
        avitoColorValue: group.avitoColorValue?.trim() || color,
        basePrice: Math.max(0, Math.round(group.basePrice ?? 0)),
        defaultStockQty: Math.max(0, Math.round(group.defaultStockQty ?? 1)),
        description: group.description ?? "",
        avitoFieldsJson: JSON.stringify(group.avitoFields ?? {}),
        sortOrder: group.sortOrder ?? index,
      },
      update: {
        supplierId: group.supplierId?.trim() || null,
        avitoColorValue: group.avitoColorValue?.trim() || color,
        basePrice: Math.max(0, Math.round(group.basePrice ?? 0)),
        defaultStockQty: Math.max(0, Math.round(group.defaultStockQty ?? 1)),
        description: group.description ?? "",
        avitoFieldsJson: JSON.stringify(group.avitoFields ?? {}),
        sortOrder: group.sortOrder ?? index,
      },
    });
  }
}

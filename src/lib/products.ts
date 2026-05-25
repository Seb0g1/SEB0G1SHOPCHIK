import { prisma } from "@/lib/prisma";
import { toClientProduct } from "@/lib/serializers";
import { expandVariants, makeSku } from "@/lib/variants";

export const productInclude = {
  variants: { orderBy: [{ color: "asc" as const }, { sortOrder: "asc" as const }, { size: "asc" as const }] },
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
  basePrice: number;
  color?: string;
  sizes?: string[];
  stockQty?: number;
}) {
  const product = await prisma.productTemplate.create({
    data: {
      title: input.title.trim(),
      brand: input.brand?.trim() || null,
      basePrice: Math.max(0, Math.round(input.basePrice)),
      description: "",
      status: "DRAFT",
    },
  });

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
    category?: string;
    goodsType?: string;
    productType?: string;
    adType?: string;
    gender?: string;
    condition?: string;
    basePrice?: number;
    description?: string;
    generatedDescription?: string | null;
    status?: string;
    variants?: Array<{
      id: string;
      color: string;
      size: string;
      price: number;
      stockQty: number;
      publicationStatus: string;
      avitoExternalId?: string | null;
    }>;
  },
) {
  const data = {
    ...(input.title !== undefined ? { title: input.title.trim() } : {}),
    ...(input.brand !== undefined ? { brand: input.brand?.trim() || null } : {}),
    ...(input.category !== undefined ? { category: input.category.trim() } : {}),
    ...(input.goodsType !== undefined ? { goodsType: input.goodsType.trim() } : {}),
    ...(input.productType !== undefined ? { productType: input.productType.trim() } : {}),
    ...(input.adType !== undefined ? { adType: input.adType.trim() } : {}),
    ...(input.gender !== undefined ? { gender: input.gender.trim() } : {}),
    ...(input.condition !== undefined ? { condition: input.condition.trim() } : {}),
    ...(input.basePrice !== undefined ? { basePrice: Math.max(0, Math.round(input.basePrice)) } : {}),
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.generatedDescription !== undefined ? { generatedDescription: input.generatedDescription } : {}),
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
          publicationStatus: variant.publicationStatus,
          avitoExternalId: variant.avitoExternalId?.trim() || null,
        },
      });
    }
  }

  return getProduct(id);
}

export async function generateVariants(
  productId: string,
  input: { title: string; color: string; sizes: string[]; price: number; stockQty: number },
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
        sortOrder: variant.sortOrder ?? 0,
        publicationStatus: "DRAFT",
      },
      update: {
        price: variant.price,
        stockQty: variant.stockQty,
        sortOrder: variant.sortOrder ?? 0,
        publicationStatus: "DRAFT",
      },
    });
  }

  return getProduct(productId);
}

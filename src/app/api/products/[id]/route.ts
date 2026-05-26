import { NextResponse } from "next/server";
import { z } from "zod";
import { getProduct, updateProduct } from "@/lib/products";

const updateProductSchema = z.object({
  title: z.string().min(2).optional(),
  brand: z.string().nullable().optional(),
  supplierId: z.string().nullable().optional(),
  category: z.string().optional(),
  goodsType: z.string().optional(),
  productType: z.string().optional(),
  adType: z.string().optional(),
  gender: z.string().optional(),
  condition: z.string().optional(),
  basePrice: z.coerce.number().int().min(0).optional(),
  description: z.string().optional(),
  generatedDescription: z.string().nullable().optional(),
  avitoCategorySlug: z.string().nullable().optional(),
  avitoCategoryName: z.string().nullable().optional(),
  avitoFields: z.record(z.string(), z.string()).optional(),
  publicationErrors: z.array(z.string()).optional(),
  status: z.string().optional(),
  variants: z
    .array(
      z.object({
        id: z.string(),
        color: z.string(),
        size: z.string(),
        price: z.coerce.number().int().min(0),
        stockQty: z.coerce.number().int().min(0),
        avitoFields: z.record(z.string(), z.string()).optional(),
        needsSync: z.boolean().optional(),
        publicationStatus: z.string(),
        avitoExternalId: z.string().nullable().optional(),
      }),
    )
    .optional(),
  colorGroups: z
    .array(
      z.object({
        id: z.string().optional(),
        color: z.string(),
        supplierId: z.string().nullable().optional(),
        avitoColorValue: z.string().nullable().optional(),
        basePrice: z.coerce.number().int().min(0),
        defaultStockQty: z.coerce.number().int().min(0),
        description: z.string().optional(),
        avitoFields: z.record(z.string(), z.string()).optional(),
        sortOrder: z.coerce.number().int().min(0).optional(),
      }),
    )
    .optional(),
});

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const product = await getProduct(id);
  if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });
  return NextResponse.json({ product });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const parsed = updateProductSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid product payload", details: parsed.error.flatten() }, { status: 400 });
  }

  const product = await updateProduct(id, parsed.data);
  if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });
  return NextResponse.json({ product });
}

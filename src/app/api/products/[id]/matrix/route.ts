import { NextResponse } from "next/server";
import { z } from "zod";
import { getProduct, updateProduct } from "@/lib/products";

const schema = z.object({
  colorGroups: z
    .array(
      z.object({
        id: z.string().optional(),
        color: z.string().min(1),
        avitoColorValue: z.string().nullable().optional(),
        basePrice: z.coerce.number().int().min(0),
        defaultStockQty: z.coerce.number().int().min(0),
        description: z.string().optional(),
        avitoFields: z.record(z.string(), z.string()).optional(),
        sortOrder: z.coerce.number().int().min(0).optional(),
      }),
    )
    .default([]),
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
    .default([]),
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const existing = await getProduct(id);
  if (!existing) return NextResponse.json({ error: "Product not found" }, { status: 404 });

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid matrix payload", details: parsed.error.flatten() }, { status: 400 });
  }

  const product = await updateProduct(id, {
    colorGroups: parsed.data.colorGroups,
    variants: parsed.data.variants,
  });

  return NextResponse.json({ product });
}

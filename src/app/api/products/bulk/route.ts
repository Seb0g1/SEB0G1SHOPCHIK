import { NextResponse } from "next/server";
import { z } from "zod";
import { createBulkProduct } from "@/lib/products";

const colorGroupSchema = z.object({
  color: z.string().min(1),
  supplierId: z.string().nullable().optional(),
  avitoColorValue: z.string().nullable().optional(),
  basePrice: z.coerce.number().int().min(0).optional(),
  defaultStockQty: z.coerce.number().int().min(0).optional(),
  description: z.string().optional(),
  avitoFields: z.record(z.string(), z.string()).optional(),
  sizes: z.array(z.string()).default([]),
  variants: z
    .array(
      z.object({
        size: z.string().min(1),
        price: z.coerce.number().int().min(0),
        stockQty: z.coerce.number().int().min(0),
      }),
    )
    .optional(),
});

const schema = z.object({
  title: z.string().min(2),
  brand: z.string().optional(),
  supplierId: z.string().nullable().optional(),
  basePrice: z.coerce.number().int().min(0),
  avitoCategorySlug: z.string().nullable().optional(),
  avitoCategoryName: z.string().nullable().optional(),
  avitoFields: z.record(z.string(), z.string()).optional(),
  colorGroups: z.array(colorGroupSchema).min(1),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid bulk product payload", details: parsed.error.flatten() }, { status: 400 });
  }

  const product = await createBulkProduct(parsed.data);
  return NextResponse.json({ product }, { status: 201 });
}

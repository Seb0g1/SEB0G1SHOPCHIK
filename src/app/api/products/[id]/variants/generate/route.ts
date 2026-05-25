import { NextResponse } from "next/server";
import { z } from "zod";
import { generateVariants, getProduct } from "@/lib/products";

const schema = z.object({
  color: z.string().min(1),
  sizes: z.array(z.string()).min(1),
  price: z.coerce.number().int().min(0),
  stockQty: z.coerce.number().int().min(0),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const existing = await getProduct(id);
  if (!existing) return NextResponse.json({ error: "Product not found" }, { status: 404 });

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid variant payload", details: parsed.error.flatten() }, { status: 400 });
  }

  const product = await generateVariants(id, {
    title: existing.title,
    color: parsed.data.color,
    sizes: parsed.data.sizes,
    price: parsed.data.price,
    stockQty: parsed.data.stockQty,
  });

  return NextResponse.json({ product });
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { createProduct, listProducts } from "@/lib/products";

const createProductSchema = z.object({
  title: z.string().min(2),
  brand: z.string().optional(),
  basePrice: z.coerce.number().int().min(0),
  color: z.string().optional(),
  sizes: z.array(z.string()).optional(),
  stockQty: z.coerce.number().int().min(0).optional(),
});

export async function GET() {
  return NextResponse.json({ products: await listProducts() });
}

export async function POST(request: Request) {
  const parsed = createProductSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid product payload", details: parsed.error.flatten() }, { status: 400 });
  }

  const product = await createProduct(parsed.data);
  return NextResponse.json({ product }, { status: 201 });
}

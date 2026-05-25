import { NextResponse } from "next/server";
import { generateDescription } from "@/lib/descriptions";
import { getProduct, updateProduct } from "@/lib/products";

export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const product = await getProduct(id);
  if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

  const result = await generateDescription(product);
  const updated = await updateProduct(id, { generatedDescription: result.description });
  return NextResponse.json({ product: updated, source: result.source });
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getProduct } from "@/lib/products";
import { saveUpload } from "@/lib/storage";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const product = await getProduct(id);
  if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

  const formData = await request.formData();
  const color = String(formData.get("color") ?? "").trim() || null;
  const files = formData.getAll("files").filter((item): item is File => item instanceof File);

  if (!files.length) {
    return NextResponse.json({ error: "No files uploaded" }, { status: 400 });
  }

  for (const [index, file] of files.entries()) {
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: `Unsupported file type: ${file.type}` }, { status: 400 });
    }
    const saved = await saveUpload(id, file);
    await prisma.photoAsset.create({
      data: {
        productId: id,
        color,
        sortOrder: product.photos.length + index,
        ...saved,
      },
    });
  }

  return NextResponse.json({ product: await getProduct(id) });
}

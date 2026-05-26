import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getProduct } from "@/lib/products";

export async function PATCH(request: Request, context: { params: Promise<{ id: string; photoId: string }> }) {
  const { id, photoId } = await context.params;
  const body = (await request.json().catch(() => ({}))) as { action?: string };
  if (body.action !== "primary") {
    return NextResponse.json({ error: "Unsupported photo action" }, { status: 400 });
  }

  const photo = await prisma.photoAsset.findFirst({ where: { id: photoId, productId: id } });
  if (!photo) {
    return NextResponse.json({ error: "Photo not found" }, { status: 404 });
  }

  const siblings = await prisma.photoAsset.findMany({
    where: { productId: id, color: photo.color },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  const ordered = [photo, ...siblings.filter((item) => item.id !== photo.id)];

  await prisma.$transaction(
    ordered.map((item, index) =>
      prisma.photoAsset.update({
        where: { id: item.id },
        data: { sortOrder: index },
      }),
    ),
  );

  return NextResponse.json({ product: await getProduct(id) });
}

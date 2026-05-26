import { prisma } from "@/lib/prisma";
import { productInclude } from "@/lib/products";
import { getRawAvitoSettings } from "@/lib/settings";
import { generateAvitoExcel } from "@/lib/avito-excel";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const productIds = parseProductIds(searchParams.get("productIds"));
  const [products, settings] = await Promise.all([getProducts(productIds), getRawAvitoSettings()]);

  try {
    const buffer = await generateAvitoExcel(products, settings);
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${downloadName(productIds.length ? "products" : "catalog")}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Не удалось сформировать Excel для Avito.",
      },
      { status: 422 },
    );
  }
}

function parseProductIds(value: string | null) {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function getProducts(productIds: string[]) {
  return prisma.productTemplate.findMany({
    where: {
      status: { not: "ARCHIVED" },
      ...(productIds.length ? { id: { in: productIds } } : {}),
    },
    include: productInclude,
    orderBy: { createdAt: "desc" },
  });
}

function downloadName(scope: string) {
  const stamp = new Date().toISOString().slice(0, 10);
  return `seb0g1shopchik-avito-${scope}-${stamp}.xlsx`;
}

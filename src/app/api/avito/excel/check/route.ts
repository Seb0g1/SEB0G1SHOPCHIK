import { prisma } from "@/lib/prisma";
import { productInclude } from "@/lib/products";
import { getRawAvitoSettings } from "@/lib/settings";
import { validateAvitoExcelExport } from "@/lib/avito-excel";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const productIds = parseProductIds(searchParams.get("productIds"));
  const [products, settings] = await Promise.all([getProducts(productIds), getRawAvitoSettings()]);
  const result = validateAvitoExcelExport(products, settings);
  return Response.json(result);
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

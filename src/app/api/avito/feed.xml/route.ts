import { prisma } from "@/lib/prisma";
import { getRawAvitoSettings } from "@/lib/settings";
import { buildAvitoFeed } from "@/lib/xml";

export async function GET() {
  const [products, settings] = await Promise.all([
    prisma.productTemplate.findMany({
      where: { status: { not: "ARCHIVED" } },
      include: {
        variants: { orderBy: [{ color: "asc" }, { sortOrder: "asc" }] },
        colorGroups: { orderBy: [{ sortOrder: "asc" }, { color: "asc" }] },
        photos: { orderBy: [{ color: "asc" }, { sortOrder: "asc" }] },
      },
    }),
    getRawAvitoSettings(),
  ]);

  const xml = buildAvitoFeed(products, {
    address: settings.address,
    publicFeedUrl: settings.publicFeedUrl,
  });

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

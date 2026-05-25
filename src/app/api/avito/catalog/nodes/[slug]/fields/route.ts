import { NextResponse } from "next/server";
import { getCatalogFields } from "@/lib/avito/catalog";

export async function GET(_: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  return NextResponse.json(await getCatalogFields(decodeURIComponent(slug)));
}

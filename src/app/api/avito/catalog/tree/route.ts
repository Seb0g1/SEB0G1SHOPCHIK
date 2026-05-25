import { NextResponse } from "next/server";
import { getCatalogTree } from "@/lib/avito/catalog";

export async function GET() {
  return NextResponse.json(await getCatalogTree());
}

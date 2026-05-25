import { NextResponse } from "next/server";
import { getFieldValues } from "@/lib/avito/catalog";

export async function GET(request: Request) {
  const url = new URL(request.url).searchParams.get("url");
  if (!url || !/^https?:\/\//i.test(url)) {
    return NextResponse.json({ error: "Valid url query parameter is required" }, { status: 400 });
  }
  return NextResponse.json(await getFieldValues(url));
}

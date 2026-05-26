import { NextResponse } from "next/server";
import { syncMessages } from "@/lib/messages";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  return NextResponse.json(await syncMessages({ force: Boolean(body.force) }));
}

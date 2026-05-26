import { NextResponse } from "next/server";
import { processMessageRules } from "@/lib/messages";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  return NextResponse.json(await processMessageRules({ force: Boolean(body.force) }));
}

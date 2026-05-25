import { NextResponse } from "next/server";
import { runOnlinePing } from "@/lib/reviews";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  return NextResponse.json(await runOnlinePing({ force: Boolean(body.force) }));
}

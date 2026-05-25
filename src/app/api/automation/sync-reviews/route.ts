import { NextResponse } from "next/server";
import { syncReviews } from "@/lib/reviews";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  return NextResponse.json(await syncReviews({ force: Boolean(body.force) }));
}

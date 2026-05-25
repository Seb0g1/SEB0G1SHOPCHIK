import { NextResponse } from "next/server";
import { listReviews } from "@/lib/reviews";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const rating = url.searchParams.get("rating");
  const reviews = await listReviews({
    status: url.searchParams.get("status") || undefined,
    rating: rating ? Number(rating) : undefined,
    replied: url.searchParams.get("replied") || undefined,
  });
  return NextResponse.json({ reviews });
}

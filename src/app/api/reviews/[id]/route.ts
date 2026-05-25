import { NextResponse } from "next/server";
import { getReviewById } from "@/lib/reviews";

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const review = await getReviewById(id);
  if (!review) return NextResponse.json({ error: "Review not found" }, { status: 404 });
  return NextResponse.json({ review });
}

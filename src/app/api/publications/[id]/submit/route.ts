import { NextResponse } from "next/server";
import { submitProductToAutoload } from "@/lib/autoload";

export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const result = await submitProductToAutoload(id);
  return NextResponse.json(result.body, { status: result.status });
}

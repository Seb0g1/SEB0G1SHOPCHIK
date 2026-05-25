import { NextResponse } from "next/server";
import { z } from "zod";
import { sendReviewReply } from "@/lib/reviews";

const schema = z.object({
  text: z.string().optional(),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid reply payload", details: parsed.error.flatten() }, { status: 400 });
  }

  const result = await sendReviewReply(id, parsed.data.text);
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { getAutomationState, updateAutomationState } from "@/lib/reviews";

const schema = z.object({
  onlineEnabled: z.boolean().optional(),
  reviewsEnabled: z.boolean().optional(),
  draftsEnabled: z.boolean().optional(),
});

export async function GET() {
  return NextResponse.json({ automation: await getAutomationState() });
}

export async function PATCH(request: Request) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid automation payload", details: parsed.error.flatten() }, { status: 400 });
  }
  return NextResponse.json({ automation: await updateAutomationState(parsed.data) });
}

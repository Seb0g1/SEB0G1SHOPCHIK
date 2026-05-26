import { NextResponse } from "next/server";
import { z } from "zod";
import { createMessageRule, listMessageRules } from "@/lib/messages";

const schema = z.object({
  name: z.string().min(1),
  keywords: z.string().min(1),
  responseText: z.string().min(1).max(1000),
  priority: z.coerce.number().int().optional(),
  cooldownSeconds: z.coerce.number().int().min(0).optional(),
  oncePerChat: z.boolean().optional(),
  active: z.boolean().optional(),
});

export async function GET() {
  return NextResponse.json({ rules: await listMessageRules() });
}

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid message rule payload", details: parsed.error.flatten() }, { status: 400 });
  }
  return NextResponse.json({ rule: await createMessageRule(parsed.data) }, { status: 201 });
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { deleteMessageRule, updateMessageRule } from "@/lib/messages";

const schema = z.object({
  name: z.string().min(1).optional(),
  keywords: z.string().min(1).optional(),
  responseText: z.string().min(1).max(1000).optional(),
  priority: z.coerce.number().int().optional(),
  cooldownSeconds: z.coerce.number().int().min(0).optional(),
  oncePerChat: z.boolean().optional(),
  active: z.boolean().optional(),
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid message rule payload", details: parsed.error.flatten() }, { status: 400 });
  }
  return NextResponse.json({ rule: await updateMessageRule(id, parsed.data) });
}

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return NextResponse.json(await deleteMessageRule(id));
}

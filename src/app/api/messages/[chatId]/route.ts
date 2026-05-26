import { NextResponse } from "next/server";
import { z } from "zod";
import { getMessageChat, sendManualMessage } from "@/lib/messages";

const schema = z.object({ text: z.string().min(1).max(1000) });

export async function GET(_: Request, context: { params: Promise<{ chatId: string }> }) {
  const { chatId } = await context.params;
  const chat = await getMessageChat(chatId);
  if (!chat) return NextResponse.json({ error: "Chat not found" }, { status: 404 });
  return NextResponse.json({ chat });
}

export async function POST(request: Request, context: { params: Promise<{ chatId: string }> }) {
  const { chatId } = await context.params;
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid message payload", details: parsed.error.flatten() }, { status: 400 });
  }
  return NextResponse.json(await sendManualMessage(chatId, parsed.data.text));
}

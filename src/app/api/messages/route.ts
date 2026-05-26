import { NextResponse } from "next/server";
import { listMessageChats } from "@/lib/messages";

export async function GET() {
  return NextResponse.json({ chats: await listMessageChats() });
}

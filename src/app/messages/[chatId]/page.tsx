import { notFound } from "next/navigation";
import { MessageDetailPage } from "@/components/message-detail-page";
import { getMessageChat } from "@/lib/messages";

export const dynamic = "force-dynamic";

export default async function MessageDetailRoute({ params }: { params: Promise<{ chatId: string }> }) {
  const { chatId } = await params;
  const chat = await getMessageChat(chatId);
  if (!chat) notFound();
  return <MessageDetailPage initialChat={chat} />;
}

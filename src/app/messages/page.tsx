import { MessagesPage } from "@/components/messages-page";
import { listMessageChats } from "@/lib/messages";

export default async function MessagesRoute() {
  const chats = await listMessageChats();
  return <MessagesPage initialChats={chats} />;
}

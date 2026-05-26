import { MessageRulesPage } from "@/components/message-rules-page";
import { listMessageRules } from "@/lib/messages";

export const dynamic = "force-dynamic";

export default async function MessageRulesRoute() {
  const rules = await listMessageRules();
  return <MessageRulesPage initialRules={rules} />;
}

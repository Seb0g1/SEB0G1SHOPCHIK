import { MessageRulesPage } from "@/components/message-rules-page";
import { listMessageRules } from "@/lib/messages";

export default async function MessageRulesRoute() {
  const rules = await listMessageRules();
  return <MessageRulesPage initialRules={rules} />;
}

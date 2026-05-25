import { AppShell } from "@/components/app-shell";
import { AutomationPage } from "@/components/automation-page";
import { getAutomationState } from "@/lib/reviews";

export const dynamic = "force-dynamic";

export default async function AutomationRoute() {
  const automation = await getAutomationState();
  return (
    <AppShell>
      <AutomationPage initialAutomation={automation} />
    </AppShell>
  );
}

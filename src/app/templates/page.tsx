import { AppShell } from "@/components/app-shell";
import { TemplatesPage } from "@/components/templates-page";
import { listTemplates } from "@/lib/reviews";

export const dynamic = "force-dynamic";

export default async function TemplatesRoute() {
  const templates = await listTemplates();
  return (
    <AppShell>
      <TemplatesPage initialTemplates={templates} />
    </AppShell>
  );
}

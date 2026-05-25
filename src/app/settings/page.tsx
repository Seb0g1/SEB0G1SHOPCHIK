import { AppShell } from "@/components/app-shell";
import { SettingsPage } from "@/components/settings-page";
import { getAvitoSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function SettingsRoute() {
  const settings = await getAvitoSettings();
  return (
    <AppShell>
      <SettingsPage initialSettings={settings} />
    </AppShell>
  );
}

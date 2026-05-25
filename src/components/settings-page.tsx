"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CheckCircle2, Save, ShieldCheck } from "lucide-react";
import type { ClientAutomationState, ClientAvitoSettings } from "@/lib/client-types";
import { Button, PageHeader, TextField, requestJson } from "@/components/ui-kit";

export function SettingsPage({ initialSettings }: { initialSettings: ClientAvitoSettings }) {
  const [settings, setSettings] = useState(initialSettings);
  const [secretDraft, setSecretDraft] = useState("");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [automation, setAutomation] = useState<ClientAutomationState | null>(null);

  useEffect(() => {
    requestJson<{ automation: ClientAutomationState }>("/api/automation")
      .then((payload) => setAutomation(payload.automation))
      .catch(() => undefined);
  }, []);

  async function save() {
    setBusy("save");
    setMessage("");
    try {
      const payload = await requestJson<{ settings: ClientAvitoSettings }>("/api/settings/avito", {
        method: "PATCH",
        body: JSON.stringify({ ...settings, clientSecret: secretDraft }),
      });
      setSettings(payload.settings);
      setSecretDraft("");
      setMessage("Настройки сохранены.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось сохранить настройки");
    } finally {
      setBusy("");
    }
  }

  async function test() {
    setBusy("test");
    setMessage("");
    try {
      const payload = await requestJson<{ ok: boolean; status: string }>("/api/settings/avito", { method: "POST" });
      setMessage(`Avito API: ${payload.status}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось проверить API");
    } finally {
      setBusy("");
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Система"
        title="Настройки Avito API"
        actions={
          <>
            <Button tone="secondary" busy={busy === "test"} onClick={test}>
              <CheckCircle2 className="h-4 w-4" />
              Проверить
            </Button>
            <Button busy={busy === "save"} onClick={save}>
              <Save className="h-4 w-4" />
              Сохранить
            </Button>
          </>
        }
      />
      <div className="grid gap-4 p-4 xl:grid-cols-[minmax(0,1fr)_360px] xl:p-6">
        <section className="rounded-md border border-line bg-white p-5 shadow-panel">
          <div className="grid gap-4 md:grid-cols-2">
            <TextField label="Client ID" value={settings.clientId} onChange={(clientId) => setSettings({ ...settings, clientId })} />
            <TextField
              label={settings.hasClientSecret ? "Client secret (заменить)" : "Client secret"}
              type="password"
              value={secretDraft}
              onChange={setSecretDraft}
            />
            <TextField
              label="Город"
              value={settings.sellerLocation}
              onChange={(sellerLocation) => setSettings({ ...settings, sellerLocation })}
            />
            <TextField label="Адрес" value={settings.address} onChange={(address) => setSettings({ ...settings, address })} />
            <TextField
              label="Контакт"
              value={settings.contactName}
              onChange={(contactName) => setSettings({ ...settings, contactName })}
            />
            <TextField label="Телефон" value={settings.phone} onChange={(phone) => setSettings({ ...settings, phone })} />
            <TextField label="Email" value={settings.email} onChange={(email) => setSettings({ ...settings, email })} />
            <TextField
              label="Redirect URL"
              value={settings.redirectUrl}
              onChange={(redirectUrl) => setSettings({ ...settings, redirectUrl })}
            />
          </div>
        </section>

        <aside className="space-y-4">
          <div className="rounded-md border border-line bg-white p-5 shadow-panel">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-sea" />
              <h2 className="font-semibold">OAuth callback</h2>
            </div>
            <p className="mt-4 break-all rounded-md bg-canvas p-3 text-sm font-semibold">{settings.redirectUrl}</p>
          </div>
          <div className="rounded-md border border-line bg-white p-5 shadow-panel">
            <h2 className="font-semibold">Публикация</h2>
            <p className="mt-3 text-sm text-moss">
              Товары отправляются через Avito API. Технические URL скрыты из рабочего интерфейса.
            </p>
          </div>
          <div className="rounded-md border border-line bg-white p-5 shadow-panel">
            <h2 className="font-semibold">Capabilities</h2>
            <div className="mt-3 space-y-2 text-sm text-moss">
              <CapabilityLine label="Отзывы" value={automation?.capabilities.reviews} />
              <CapabilityLine label="Ответы" value={automation?.capabilities.reviewReplies} />
              <CapabilityLine label="Online presence" value={automation?.capabilities.onlinePresence} />
            </div>
            <Link className="mt-4 inline-flex text-sm font-semibold text-sea" href="/automation">
              Открыть автоматизацию
            </Link>
          </div>
          {message ? <p className="rounded-md bg-ink p-3 text-sm font-semibold text-white">{message}</p> : null}
        </aside>
      </div>
    </>
  );
}

function CapabilityLine({ label, value }: { label: string; value: unknown }) {
  const item = typeof value === "object" && value ? (value as { available?: boolean; status?: string | number }) : null;
  return (
    <p className="flex items-center justify-between gap-3">
      <span>{label}</span>
      <span className={item?.available ? "font-semibold text-emerald-700" : "font-semibold text-zinc-600"}>
        {item ? (item.available ? "доступно" : item.status || "нет доступа") : "не проверено"}
      </span>
    </p>
  );
}

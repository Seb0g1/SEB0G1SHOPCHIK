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

  async function readFreshSettings() {
    const payload = await requestJson<{ settings: ClientAvitoSettings }>("/api/settings/avito");
    setSettings(payload.settings);
    return payload.settings;
  }

  async function save() {
    setBusy("save");
    setMessage("");
    try {
      await requestJson<{ settings: ClientAvitoSettings }>("/api/settings/avito", {
        method: "PATCH",
        body: JSON.stringify({ ...settings, clientSecret: secretDraft }),
      });
      const freshSettings = await readFreshSettings();
      setSecretDraft("");
      const secretText =
        freshSettings.secretStatus === "invalid"
          ? "Client secret есть в базе, но не читается текущим SETTINGS_ENCRYPTION_KEY."
          : freshSettings.hasClientSecret
            ? "Client secret сохранен и читается."
            : "Client secret пока не заполнен.";
      setMessage(`Настройки сохранены и перечитаны из базы. ${secretText}`);
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
      const payload = await requestJson<{ ok: boolean; status: string; capabilities?: Record<string, unknown> }>("/api/settings/avito", { method: "POST" });
      await readFreshSettings();
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
      <div className="grid gap-4 p-4 xl:grid-cols-[minmax(0,1fr)_380px] xl:p-6">
        <section className="space-y-6 rounded-md border border-line bg-white p-5 shadow-panel">
          <div>
            <h2 className="font-semibold">Авторизация</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <TextField label="Client ID" value={settings.clientId} onChange={(clientId) => setSettings({ ...settings, clientId })} />
              <TextField label={settings.hasClientSecret ? "Client secret (заменить)" : "Client secret"} type="password" value={secretDraft} onChange={setSecretDraft} />
              <TextField label="Avito User ID / accountId" value={settings.avitoUserId} onChange={(avitoUserId) => setSettings({ ...settings, avitoUserId })} />
              <TextField label="Redirect URL" value={settings.redirectUrl} onChange={(redirectUrl) => setSettings({ ...settings, redirectUrl })} />
            </div>
            <SecretStatus status={settings.secretStatus} />
          </div>

          <div>
            <h2 className="font-semibold">Контакты объявления</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <TextField label="Город" value={settings.sellerLocation} onChange={(sellerLocation) => setSettings({ ...settings, sellerLocation })} />
              <TextField label="Адрес" value={settings.address} onChange={(address) => setSettings({ ...settings, address })} />
              <TextField label="Контакт" value={settings.contactName} onChange={(contactName) => setSettings({ ...settings, contactName })} />
              <TextField label="Телефон" value={settings.phone} onChange={(phone) => setSettings({ ...settings, phone })} />
              <TextField label="Email" value={settings.email} onChange={(email) => setSettings({ ...settings, email })} />
            </div>
          </div>

          <div>
            <h2 className="font-semibold">Autoload API</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <TextField label="Скрытый feed URL" value={settings.publicFeedUrl} onChange={(publicFeedUrl) => setSettings({ ...settings, publicFeedUrl })} />
              <TextField label="Email отчетов" value={settings.autoloadReportEmail} onChange={(autoloadReportEmail) => setSettings({ ...settings, autoloadReportEmail })} />
              <label className="block md:col-span-2">
                <span className="mb-1 block text-xs font-semibold text-moss">Расписание Autoload JSON</span>
                <textarea
                  className="min-h-[110px] w-full rounded-md border-line font-mono text-sm"
                  value={settings.autoloadScheduleJson}
                  onChange={(event) => setSettings({ ...settings, autoloadScheduleJson: event.target.value })}
                />
              </label>
            </div>
          </div>
        </section>

        <aside className="space-y-4">
          <div className="rounded-md border border-line bg-white p-5 shadow-panel">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-sea" />
              <h2 className="font-semibold">OAuth callback</h2>
            </div>
            <p className="mt-4 break-all rounded-md bg-canvas p-3 text-sm font-semibold">{settings.redirectUrl}</p>
            <p className="mt-3 text-sm leading-6 text-moss">Если Avito принял только корень домена, для OAuth лучше добавить точный callback выше.</p>
          </div>
          <div className="rounded-md border border-line bg-white p-5 shadow-panel">
            <h2 className="font-semibold">Состояние сохранения</h2>
            <div className="mt-3 space-y-2 text-sm">
              <SettingsStatusLine label="Client ID" value={sourceLabel(settings.clientIdSource)} />
              <SettingsStatusLine label="Client secret" value={secretSourceLabel(settings)} />
              <SettingsStatusLine label="Последнее сохранение" value={formatSavedAt(settings.updatedAt)} />
            </div>
            <p className="mt-3 rounded-md bg-canvas p-3 text-xs leading-5 text-moss">
              Поле Client secret очищается после сохранения специально: приложение хранит зашифрованный secret и показывает только статус чтения.
            </p>
          </div>
          <div className="rounded-md border border-line bg-white p-5 shadow-panel">
            <h2 className="font-semibold">Capabilities</h2>
            <div className="mt-3 space-y-2 text-sm text-moss">
              <CapabilityLine label="Autoload" value={settings.capabilities.autoloadProfile ?? automation?.capabilities.autoloadProfile} />
              <CapabilityLine label="Отзывы" value={settings.capabilities.reviews ?? automation?.capabilities.reviews} />
              <CapabilityLine label="Ответы" value={settings.capabilities.reviewReplies ?? automation?.capabilities.reviewReplies} />
              <CapabilityLine label="Messenger" value={settings.capabilities.messenger ?? automation?.capabilities.messenger} />
              <CapabilityLine label="Online" value={settings.capabilities.onlinePresence ?? automation?.capabilities.onlinePresence} />
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

function SettingsStatusLine({ label, value }: { label: string; value: string }) {
  return (
    <p className="flex items-center justify-between gap-3 border-b border-line pb-2 last:border-b-0">
      <span className="text-moss">{label}</span>
      <span className="text-right font-semibold text-ink">{value}</span>
    </p>
  );
}

function sourceLabel(source: ClientAvitoSettings["clientIdSource"]) {
  if (source === "database") return "сохранен в базе";
  if (source === "env") return "берется из .env";
  return "не заполнен";
}

function secretSourceLabel(settings: ClientAvitoSettings) {
  if (settings.secretStatus === "ok") return "сохранен в базе";
  if (settings.secretStatus === "env") return "берется из .env";
  if (settings.secretStatus === "invalid") return "не читается";
  return "не заполнен";
}

function formatSavedAt(value: string | null) {
  if (!value) return "еще не сохранено";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function CapabilityLine({ label, value }: { label: string; value: unknown }) {
  const item = typeof value === "object" && value ? (value as { available?: boolean; status?: string | number; message?: string }) : null;
  return (
    <div className="border-b border-line pb-2 last:border-b-0">
      <p className="flex items-center justify-between gap-3">
        <span>{label}</span>
        <span className={item?.available ? "font-semibold text-emerald-700" : "font-semibold text-zinc-600"}>
          {item ? (item.available ? "доступно" : item.status || "нет доступа") : "не проверено"}
        </span>
      </p>
      {item?.message ? <p className="mt-1 text-xs leading-5 text-zinc-600">{item.message}</p> : null}
    </div>
  );
}

function SecretStatus({ status }: { status: ClientAvitoSettings["secretStatus"] }) {
  const map = {
    ok: {
      className: "border-emerald-100 bg-emerald-50 text-emerald-700",
      text: "Client secret сохранен и читается текущим ключом шифрования.",
    },
    env: {
      className: "border-sky-100 bg-sky-50 text-sky-700",
      text: "Client secret берется из AVITO_CLIENT_SECRET в .env.",
    },
    invalid: {
      className: "border-red-100 bg-red-50 text-red-700",
      text: "Client secret есть в базе, но не расшифровывается. Скорее всего изменился SETTINGS_ENCRYPTION_KEY. Вставьте secret заново и сохраните.",
    },
    empty: {
      className: "border-amber-100 bg-amber-50 text-amber-700",
      text: "Client secret не заполнен.",
    },
  }[status];

  return <p className={`mt-3 rounded-md border p-3 text-sm font-semibold ${map.className}`}>{map.text}</p>;
}

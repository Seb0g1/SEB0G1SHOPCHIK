"use client";

import { Activity, CheckCircle2, Clock3, RefreshCw, ShieldAlert, Wifi } from "lucide-react";
import { useState } from "react";
import type { ReactNode } from "react";
import type { ClientAutomationState } from "@/lib/client-types";
import { Button, PageHeader, requestJson } from "@/components/ui-kit";

export function AutomationPage({ initialAutomation }: { initialAutomation: ClientAutomationState }) {
  const [automation, setAutomation] = useState(initialAutomation);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");

  async function patch(payload: Partial<ClientAutomationState>) {
    setBusy("save");
    setMessage("");
    try {
      const result = await requestJson<{ automation: ClientAutomationState }>("/api/automation", {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      setAutomation(result.automation);
      setMessage("Настройки worker-а сохранены.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось сохранить настройки");
    } finally {
      setBusy("");
    }
  }

  async function action(name: "probe" | "online-ping" | "sync-reviews") {
    setBusy(name);
    setMessage("");
    try {
      const endpoint = name === "probe" ? "/api/automation/probe" : `/api/automation/${name}`;
      const result = await requestJson<{
        ok?: boolean;
        automation?: ClientAutomationState;
        state?: ClientAutomationState;
        synced?: number;
        drafts?: number;
        message?: string;
      }>(endpoint, {
        method: "POST",
        body: JSON.stringify({ force: true }),
      });
      setAutomation(result.automation || result.state || automation);
      if (name === "sync-reviews") {
        setMessage(`Отзывы: ${result.synced ?? 0}, черновики: ${result.drafts ?? 0}`);
      } else {
        setMessage(result.message || "Готово.");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Действие не выполнено");
    } finally {
      setBusy("");
    }
  }

  const capabilities = automation.capabilities || {};

  return (
    <>
      <PageHeader
        eyebrow="Онлайн и отзывы"
        title="Автоматизация"
        actions={
          <>
            <Button tone="secondary" busy={busy === "probe"} onClick={() => action("probe")}>
              <ShieldAlert className="h-4 w-4" />
              Проверить доступы
            </Button>
            <Button tone="secondary" busy={busy === "online-ping"} onClick={() => action("online-ping")}>
              <Wifi className="h-4 w-4" />
              Online ping
            </Button>
            <Button busy={busy === "sync-reviews"} onClick={() => action("sync-reviews")}>
              <RefreshCw className="h-4 w-4" />
              Синхронизировать отзывы
            </Button>
          </>
        }
      />
      <div className="space-y-4 p-4 xl:p-6">
        <div className="grid gap-3 lg:grid-cols-4">
          <StatusCard icon={<Activity className="h-5 w-5" />} label="Worker" value={automation.status} />
          <StatusCard
            icon={<Wifi className="h-5 w-5" />}
            label="Online"
            value={automation.lastOnlinePingAt ? new Date(automation.lastOnlinePingAt).toLocaleString("ru-RU") : "нет ping"}
          />
          <StatusCard
            icon={<RefreshCw className="h-5 w-5" />}
            label="Отзывы"
            value={automation.lastReviewsSyncAt ? new Date(automation.lastReviewsSyncAt).toLocaleString("ru-RU") : "нет sync"}
          />
          <StatusCard icon={<Clock3 className="h-5 w-5" />} label="Обновлено" value={new Date(automation.updatedAt).toLocaleString("ru-RU")} />
        </div>

        <section className="grid gap-4 rounded-md border border-line bg-white p-5 shadow-panel lg:grid-cols-3">
          <Toggle
            checked={automation.onlineEnabled}
            label="Поддерживать онлайн"
            hint="Worker отправляет официальный Avito presence ping, если endpoint доступен."
            onChange={(onlineEnabled) => patch({ onlineEnabled })}
          />
          <Toggle
            checked={automation.reviewsEnabled}
            label="Синхронизировать отзывы"
            hint="Новые и обновленные отзывы подтягиваются из Avito API."
            onChange={(reviewsEnabled) => patch({ reviewsEnabled })}
          />
          <Toggle
            checked={automation.draftsEnabled}
            label="Создавать черновики"
            hint="Ответы подбираются по шаблонам, но не отправляются автоматически."
            onChange={(draftsEnabled) => patch({ draftsEnabled })}
          />
        </section>

        {automation.lastError ? (
          <p className="rounded-md bg-red-50 p-4 text-sm font-semibold text-red-700">{automation.lastError}</p>
        ) : null}
        {message ? <p className="rounded-md border border-line bg-white p-3 text-sm font-semibold text-moss">{message}</p> : null}

        <section className="rounded-md border border-line bg-white p-5 shadow-panel">
          <div className="mb-4 flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-sea" />
            <h2 className="text-lg font-semibold">Capabilities Avito API</h2>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {["profile", "reviews", "reviewReplies", "onlinePresence"].map((key) => (
              <Capability key={key} name={key} value={capabilities[key]} />
            ))}
          </div>
        </section>

        <section className="rounded-md border border-line bg-white p-5 shadow-panel">
          <h2 className="text-lg font-semibold">Worker</h2>
          <div className="mt-4 grid gap-3 font-mono text-sm md:grid-cols-2">
            <EnvLine name="AVITO_WORKER_ONLINE_INTERVAL_SECONDS" value="45" />
            <EnvLine name="AVITO_WORKER_REVIEWS_INTERVAL_SECONDS" value="180" />
            <EnvLine name="AVITO_ONLINE_PRESENCE_PATH" value="/messenger/v1/accounts/{accountId}/online" />
            <EnvLine name="AVITO_REVIEWS_LIST_PATH" value="/ratings/v1/reviews" />
          </div>
        </section>
      </div>
    </>
  );
}

function StatusCard({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-md border border-line bg-white p-4 shadow-panel">
      <div className="flex items-center justify-between gap-3 text-moss">
        <p className="text-sm font-semibold">{label}</p>
        {icon}
      </div>
      <p className="mt-3 break-words text-sm font-semibold text-ink">{value}</p>
    </div>
  );
}

function Toggle({
  checked,
  label,
  hint,
  onChange,
}: {
  checked: boolean;
  label: string;
  hint: string;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer gap-3">
      <input
        className="mt-1 rounded border-line text-sea"
        checked={checked}
        type="checkbox"
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>
        <span className="block font-semibold">{label}</span>
        <span className="mt-1 block text-sm leading-6 text-moss">{hint}</span>
      </span>
    </label>
  );
}

function Capability({ name, value }: { name: string; value: unknown }) {
  const item = typeof value === "object" && value ? (value as { available?: boolean; message?: string; status?: string | number }) : null;
  const available = Boolean(item?.available);
  return (
    <div className={`rounded-md border p-4 ${available ? "border-emerald-200 bg-emerald-50" : "border-line bg-canvas"}`}>
      <p className={`text-sm font-semibold ${available ? "text-emerald-700" : "text-moss"}`}>{name}</p>
      <p className="mt-2 text-xs font-semibold uppercase text-zinc-600">{item?.status ?? "unknown"}</p>
      {item?.message ? <p className="mt-2 text-sm leading-5 text-zinc-700">{item.message}</p> : null}
    </div>
  );
}

function EnvLine({ name, value }: { name: string; value: string }) {
  return (
    <div className="rounded-md bg-canvas p-3">
      <p className="text-xs text-moss">{name}</p>
      <p className="mt-1 break-all text-ink">{value}</p>
    </div>
  );
}

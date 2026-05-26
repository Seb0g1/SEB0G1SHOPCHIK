"use client";

import { Activity, CheckCircle2, Clock3, MessageCircle, RefreshCw, ShieldAlert, ShoppingBag, Wifi } from "lucide-react";
import { useState } from "react";
import type { ReactNode } from "react";
import type { ClientAutomationState } from "@/lib/client-types";
import { Button, PageHeader, requestJson } from "@/components/ui-kit";

type ActionName = "probe" | "online-ping" | "sync-reviews" | "sync-messages" | "process-message-rules" | "sync-reports" | "sync-orders";

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

  async function action(name: ActionName) {
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
        autoSent?: number;
        sent?: number;
        tasks?: number;
        reports?: unknown[];
        message?: string;
      }>(endpoint, { method: "POST", body: JSON.stringify({ force: true }) });
      setAutomation(result.automation || result.state || automation);
      setMessage(buildActionMessage(name, result));
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
        eyebrow="Avito API"
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
              Отзывы
            </Button>
          </>
        }
      />
      <div className="space-y-4 p-4 xl:p-6">
        <div className="grid gap-3 lg:grid-cols-5">
          <StatusCard icon={<Activity className="h-5 w-5" />} label="Worker" value={automation.status} />
          <StatusCard icon={<Wifi className="h-5 w-5" />} label="Online" value={formatDate(automation.lastOnlinePingAt, "нет ping")} />
          <StatusCard icon={<MessageCircle className="h-5 w-5" />} label="Сообщения" value={formatDate(automation.lastMessagesSyncAt, "нет sync")} />
          <StatusCard icon={<Clock3 className="h-5 w-5" />} label="Отчеты" value={formatDate(automation.lastReportsSyncAt, "нет sync")} />
          <StatusCard icon={<ShoppingBag className="h-5 w-5" />} label="Заказы" value={formatDate(automation.lastOrdersSyncAt, "нет sync")} />
        </div>

        <section className="grid gap-4 rounded-md border border-line bg-white p-5 shadow-panel lg:grid-cols-3">
          <Toggle checked={automation.onlineEnabled} label="Поддерживать онлайн" hint="Официальный Avito presence ping, если API подтвердил доступ." onChange={(onlineEnabled) => patch({ onlineEnabled })} />
          <Toggle checked={automation.reviewsEnabled} label="Синхронизировать отзывы" hint="Worker получает новые отзывы и создает черновики ответов." onChange={(reviewsEnabled) => patch({ reviewsEnabled })} />
          <Toggle checked={automation.draftsEnabled} label="Создавать черновики" hint="Шаблоны подбираются по рейтингу и ключевым словам." onChange={(draftsEnabled) => patch({ draftsEnabled })} />
          <Toggle checked={automation.reviewAutoSendEnabled} label="Автоотправка отзывов" hint="Отправляет только шаблоны с включенным флагом автоотправки." onChange={(reviewAutoSendEnabled) => patch({ reviewAutoSendEnabled })} />
          <Toggle checked={automation.messagesEnabled} label="Синхронизировать сообщения" hint="Получает чаты и сообщения через Messenger API." onChange={(messagesEnabled) => patch({ messagesEnabled })} />
          <Toggle checked={automation.messageAutoRepliesEnabled} label="Автоответы в чатах" hint="Включенные правила отвечают по ключевым словам с антидублем." onChange={(messageAutoRepliesEnabled) => patch({ messageAutoRepliesEnabled })} />
          <Toggle checked={automation.reportsEnabled} label="Отчеты Autoload" hint="Worker подтягивает отчеты публикации и ошибки Avito." onChange={(reportsEnabled) => patch({ reportsEnabled })} />
          <Toggle checked={automation.ordersEnabled} label="Синхронизировать заказы" hint="Worker получает заказы через официальный Orders API и создает задачи поставщику." onChange={(ordersEnabled) => patch({ ordersEnabled })} />
        </section>

        <section className="rounded-md border border-line bg-white p-5 shadow-panel">
          <div className="mb-4 flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-sea" />
            <h2 className="text-lg font-semibold">Ручные действия</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button tone="secondary" busy={busy === "sync-messages"} onClick={() => action("sync-messages")}>Синхронизировать сообщения</Button>
            <Button tone="secondary" busy={busy === "process-message-rules"} onClick={() => action("process-message-rules")}>Запустить правила чата</Button>
            <Button tone="secondary" busy={busy === "sync-reports"} onClick={() => action("sync-reports")}>Синхронизировать отчеты</Button>
            <Button tone="secondary" busy={busy === "sync-orders"} onClick={() => action("sync-orders")}>Синхронизировать заказы</Button>
          </div>
        </section>

        {automation.lastError ? <p className="rounded-md bg-red-50 p-4 text-sm font-semibold text-red-700">{automation.lastError}</p> : null}
        {message ? <p className="rounded-md border border-line bg-white p-3 text-sm font-semibold text-moss">{message}</p> : null}

        <section className="rounded-md border border-line bg-white p-5 shadow-panel">
          <div className="mb-4 flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-sea" />
            <h2 className="text-lg font-semibold">Capabilities Avito API</h2>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {["profile", "autoloadProfile", "autoloadReports", "reviews", "reviewReplies", "onlinePresence", "messenger", "orders"].map((key) => (
              <Capability key={key} name={key} value={capabilities[key]} />
            ))}
          </div>
        </section>

        <section className="rounded-md border border-line bg-white p-5 shadow-panel">
          <h2 className="text-lg font-semibold">Worker env</h2>
          <div className="mt-4 grid gap-3 font-mono text-sm md:grid-cols-2">
            <EnvLine name="AVITO_WORKER_ONLINE_INTERVAL_SECONDS" value="45" />
            <EnvLine name="AVITO_WORKER_REVIEWS_INTERVAL_SECONDS" value="180" />
            <EnvLine name="AVITO_WORKER_MESSAGES_INTERVAL_SECONDS" value="45" />
            <EnvLine name="AVITO_WORKER_REPORTS_INTERVAL_SECONDS" value="300" />
            <EnvLine name="AVITO_WORKER_ORDERS_INTERVAL_SECONDS" value="120" />
          </div>
        </section>
      </div>
    </>
  );
}

function buildActionMessage(name: ActionName, result: { synced?: number; drafts?: number; autoSent?: number; sent?: number; tasks?: number; reports?: unknown[]; message?: string }) {
  if (name === "sync-reviews") return `Отзывы: ${result.synced ?? 0}, черновики: ${result.drafts ?? 0}, авто: ${result.autoSent ?? 0}`;
  if (name === "sync-messages") return `Сообщения: ${result.synced ?? 0}`;
  if (name === "process-message-rules") return `Автоответы: ${result.sent ?? 0}`;
  if (name === "sync-reports") return `Отчеты: ${result.reports?.length ?? 0}`;
  if (name === "sync-orders") return `Заказы: ${result.synced ?? 0}, задачи поставщику: ${result.tasks ?? 0}`;
  return result.message || "Готово.";
}

function formatDate(value: string | null, fallback: string) {
  return value ? new Date(value).toLocaleString("ru-RU") : fallback;
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

function Toggle({ checked, label, hint, onChange }: { checked: boolean; label: string; hint: string; onChange: (value: boolean) => void }) {
  return (
    <label className="flex cursor-pointer gap-3">
      <input className="mt-1 rounded border-line text-sea" checked={checked} type="checkbox" onChange={(event) => onChange(event.target.checked)} />
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

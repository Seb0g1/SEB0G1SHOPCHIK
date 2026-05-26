"use client";

import Link from "next/link";
import { MessageCircle, RefreshCw, Search, Send } from "lucide-react";
import { useMemo, useState } from "react";
import type { ClientMessageChat } from "@/lib/client-types";
import { Button, EmptyState, PageHeader, StatusPill, requestJson } from "@/components/ui-kit";

export function MessagesPage({ initialChats }: { initialChats: ClientMessageChat[] }) {
  const [chats, setChats] = useState(initialChats);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");

  const filtered = useMemo(() => {
    const normalized = query.toLowerCase();
    return chats.filter((chat) => `${chat.buyerName ?? ""} ${chat.itemTitle ?? ""} ${chat.title ?? ""}`.toLowerCase().includes(normalized));
  }, [chats, query]);

  async function sync() {
    setBusy("sync");
    setMessage("");
    try {
      const result = await requestJson<{ ok: boolean; synced: number; message?: string }>("/api/automation/sync-messages", {
        method: "POST",
        body: JSON.stringify({ force: true }),
      });
      const payload = await requestJson<{ chats: ClientMessageChat[] }>("/api/messages");
      setChats(payload.chats);
      setMessage(result.ok ? `Синхронизировано сообщений: ${result.synced}` : result.message || "Avito вернул ошибку.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось синхронизировать сообщения");
    } finally {
      setBusy("");
    }
  }

  async function processRules() {
    setBusy("rules");
    setMessage("");
    try {
      const result = await requestJson<{ ok: boolean; sent: number; message?: string }>("/api/automation/process-message-rules", {
        method: "POST",
        body: JSON.stringify({ force: true }),
      });
      const payload = await requestJson<{ chats: ClientMessageChat[] }>("/api/messages");
      setChats(payload.chats);
      setMessage(result.ok ? `Автоответов отправлено: ${result.sent}` : result.message || "Правила не выполнены.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось обработать правила");
    } finally {
      setBusy("");
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Avito Messenger"
        title="Сообщения"
        actions={
          <>
            <Button tone="secondary" busy={busy === "sync"} onClick={sync}>
              <RefreshCw className="h-4 w-4" />
              Синхронизировать
            </Button>
            <Button busy={busy === "rules"} onClick={processRules}>
              <Send className="h-4 w-4" />
              Запустить правила
            </Button>
          </>
        }
      />
      <div className="space-y-4 p-4 xl:p-6">
        <div className="grid gap-3 md:grid-cols-4">
          <Metric label="Чатов" value={chats.length} />
          <Metric label="Непрочитано" value={chats.reduce((sum, chat) => sum + chat.unreadCount, 0)} />
          <Metric label="С автоответом" value={chats.filter((chat) => chat.replyLogs?.some((log) => log.status === "SENT")).length} />
          <Metric label="Ошибок" value={chats.filter((chat) => chat.replyLogs?.some((log) => log.status === "FAILED")).length} danger />
        </div>

        <div className="rounded-md border border-line bg-white p-3 shadow-panel">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-moss" />
            <input
              className="h-10 w-full rounded-md border-line pl-9 text-sm"
              placeholder="Поиск по клиенту, товару или чату"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
        </div>

        {message ? <p className="rounded-md border border-line bg-white p-3 text-sm font-semibold text-moss">{message}</p> : null}

        {filtered.length ? (
          <div className="overflow-hidden rounded-md border border-line bg-white shadow-panel">
            <div className="grid grid-cols-[1.2fr_1fr_.8fr_.8fr] gap-3 border-b border-line bg-canvas px-4 py-3 text-xs font-semibold uppercase text-moss max-lg:hidden">
              <span>Клиент / товар</span>
              <span>Последнее сообщение</span>
              <span>Автоответ</span>
              <span>Обновлено</span>
            </div>
            <div className="divide-y divide-line">
              {filtered.map((chat) => (
                <Link
                  key={chat.id}
                  className="grid gap-3 px-4 py-4 transition hover:bg-canvas lg:grid-cols-[1.2fr_1fr_.8fr_.8fr] lg:items-center"
                  href={`/messages/${chat.id}`}
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{chat.buyerName || chat.title || "Клиент Avito"}</p>
                    <p className="mt-1 truncate text-sm text-moss">{chat.itemTitle || "Товар не указан"}</p>
                  </div>
                  <p className="line-clamp-2 text-sm text-zinc-700">{chat.messages?.[0]?.text || "Сообщений пока нет"}</p>
                  <StatusPill status={chat.replyLogs?.[0]?.status || "NO_REPLY"} />
                  <p className="text-sm text-moss">{chat.lastMessageAt ? new Date(chat.lastMessageAt).toLocaleString("ru-RU") : "нет даты"}</p>
                </Link>
              ))}
            </div>
          </div>
        ) : (
          <EmptyState
            title="Сообщения пока не синхронизированы"
            action={
              <Button busy={busy === "sync"} onClick={sync}>
                <MessageCircle className="h-4 w-4" />
                Получить чаты
              </Button>
            }
          />
        )}
      </div>
    </>
  );
}

function Metric({ label, value, danger = false }: { label: string; value: number; danger?: boolean }) {
  return (
    <div className="rounded-md border border-line bg-white p-4 shadow-panel">
      <p className="text-sm font-semibold text-moss">{label}</p>
      <p className={`mt-2 text-3xl font-semibold ${danger && value > 0 ? "text-signal" : "text-ink"}`}>{value}</p>
    </div>
  );
}

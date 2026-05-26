"use client";

import Link from "next/link";
import { ArrowLeft, Send } from "lucide-react";
import { useState } from "react";
import type { ClientMessageChat } from "@/lib/client-types";
import { Button, PageHeader, StatusPill, requestJson } from "@/components/ui-kit";

export function MessageDetailPage({ initialChat }: { initialChat: ClientMessageChat }) {
  const [chat, setChat] = useState(initialChat);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  async function refresh() {
    const payload = await requestJson<{ chat: ClientMessageChat }>(`/api/messages/${chat.id}`);
    setChat(payload.chat);
  }

  async function send() {
    setBusy(true);
    setNotice("");
    try {
      const result = await requestJson<{ ok: boolean; message?: string }>(`/api/messages/${chat.id}`, {
        method: "POST",
        body: JSON.stringify({ text }),
      });
      setText("");
      await refresh();
      setNotice(result.ok ? "Ответ отправлен в Avito." : result.message || "Avito вернул ошибку.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Не удалось отправить сообщение");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow={chat.itemTitle || "Avito Messenger"}
        title={chat.buyerName || chat.title || "Чат Avito"}
        actions={
          <Link href="/messages">
            <Button tone="secondary">
              <ArrowLeft className="h-4 w-4" />
              Назад
            </Button>
          </Link>
        }
      />
      <div className="grid gap-4 p-4 xl:grid-cols-[minmax(0,1fr)_340px] xl:p-6">
        <section className="rounded-md border border-line bg-white p-5 shadow-panel">
          <div className="max-h-[560px] space-y-3 overflow-y-auto pr-1">
            {(chat.messages ?? []).map((message) => (
              <div key={message.id} className={`flex ${message.direction === "OUT" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[78%] rounded-md p-3 ${message.direction === "OUT" ? "bg-sea text-white" : "bg-canvas text-ink"}`}>
                  <p className="whitespace-pre-line text-sm leading-6">{message.text || "Без текста"}</p>
                  <p className={`mt-2 text-xs ${message.direction === "OUT" ? "text-teal-50" : "text-moss"}`}>
                    {message.sentAt ? new Date(message.sentAt).toLocaleString("ru-RU") : "нет даты"}
                  </p>
                </div>
              </div>
            ))}
            {!chat.messages?.length ? <p className="rounded-md bg-canvas p-4 text-sm text-moss">Сообщения еще не загружены.</p> : null}
          </div>
          <div className="mt-5 border-t border-line pt-4">
            <textarea
              className="min-h-[120px] w-full rounded-md border-line text-sm"
              placeholder="Ответ клиенту"
              value={text}
              onChange={(event) => setText(event.target.value)}
            />
            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="text-sm text-moss">{notice}</p>
              <Button busy={busy} disabled={!text.trim()} onClick={send}>
                <Send className="h-4 w-4" />
                Отправить
              </Button>
            </div>
          </div>
        </section>
        <aside className="space-y-4">
          <div className="rounded-md border border-line bg-white p-4 shadow-panel">
            <p className="text-sm font-semibold text-moss">Avito Chat ID</p>
            <p className="mt-2 break-all font-mono text-sm">{chat.avitoChatId}</p>
          </div>
          <div className="rounded-md border border-line bg-white p-4 shadow-panel">
            <p className="font-semibold">История автоответов</p>
            <div className="mt-3 space-y-3">
              {(chat.replyLogs ?? []).map((log) => (
                <div key={log.id} className="rounded-md border border-line p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <StatusPill status={log.status} />
                    <span className="text-xs text-moss">{new Date(log.createdAt).toLocaleString("ru-RU")}</span>
                  </div>
                  <p className="mt-2 whitespace-pre-line text-zinc-700">{log.text}</p>
                  {log.rule ? <p className="mt-2 text-xs font-semibold text-sea">Правило: {log.rule.name}</p> : null}
                  {log.error ? <p className="mt-2 text-xs font-semibold text-red-700">{log.error}</p> : null}
                </div>
              ))}
              {!chat.replyLogs?.length ? <p className="text-sm text-moss">Автоответов пока нет.</p> : null}
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}

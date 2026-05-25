"use client";

import Link from "next/link";
import { ArrowLeft, RefreshCw, Save, Send, Star } from "lucide-react";
import { useState } from "react";
import type { ClientReview } from "@/lib/client-types";
import { Button, PageHeader, StatusPill, requestJson } from "@/components/ui-kit";

export function ReviewDetailPage({ initialReview }: { initialReview: ClientReview }) {
  const [review, setReview] = useState(initialReview);
  const [draftText, setDraftText] = useState(initialReview.replyDraft?.text ?? "");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");

  async function refreshReview() {
    const payload = await requestJson<{ review: ClientReview }>(`/api/reviews/${review.id}`);
    setReview(payload.review);
    setDraftText(payload.review.replyDraft?.text ?? "");
  }

  async function generateDraft() {
    setBusy("generate");
    setMessage("");
    try {
      await requestJson(`/api/reviews/${review.id}/draft`, {
        method: "POST",
        body: JSON.stringify({ regenerate: true }),
      });
      await refreshReview();
      setMessage("Черновик обновлен по правилам шаблонов.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось создать черновик");
    } finally {
      setBusy("");
    }
  }

  async function saveDraft() {
    setBusy("save");
    setMessage("");
    try {
      await requestJson(`/api/reviews/${review.id}/draft`, {
        method: "POST",
        body: JSON.stringify({ text: draftText, templateId: review.replyDraft?.templateId ?? null }),
      });
      await refreshReview();
      setMessage("Черновик сохранен.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось сохранить черновик");
    } finally {
      setBusy("");
    }
  }

  async function sendReply() {
    setBusy("send");
    setMessage("");
    try {
      const result = await requestJson<{ ok: boolean; message?: string }>(`/api/reviews/${review.id}/send`, {
        method: "POST",
        body: JSON.stringify({ text: draftText }),
      });
      await refreshReview();
      setMessage(result.ok ? "Ответ отправлен в Avito." : result.message || "Avito вернул ошибку.");
    } catch (error) {
      await refreshReview().catch(() => undefined);
      setMessage(error instanceof Error ? error.message : "Не удалось отправить ответ");
    } finally {
      setBusy("");
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Отзывы"
        title={review.itemTitle || "Карточка отзыва"}
        actions={
          <>
            <Link href="/reviews">
              <Button tone="secondary">
                <ArrowLeft className="h-4 w-4" />
                Назад
              </Button>
            </Link>
            <Button tone="secondary" busy={busy === "generate"} onClick={generateDraft}>
              <RefreshCw className="h-4 w-4" />
              Подобрать шаблон
            </Button>
            <Button tone="secondary" busy={busy === "save"} onClick={saveDraft}>
              <Save className="h-4 w-4" />
              Сохранить
            </Button>
            <Button busy={busy === "send"} disabled={!draftText.trim()} onClick={sendReply}>
              <Send className="h-4 w-4" />
              Отправить
            </Button>
          </>
        }
      />
      <div className="grid gap-4 p-4 xl:grid-cols-[minmax(0,1fr)_380px] xl:p-6">
        <main className="space-y-4">
          <section className="rounded-md border border-line bg-white p-5 shadow-panel">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-moss">{review.authorName || "Покупатель Avito"}</p>
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-2xl font-semibold">{review.rating}</span>
                  <div className="flex">
                    {Array.from({ length: 5 }).map((_, index) => (
                      <Star
                        key={index}
                        className={`h-5 w-5 ${index < review.rating ? "fill-honey text-honey" : "text-line"}`}
                      />
                    ))}
                  </div>
                </div>
              </div>
              <StatusPill status={review.replyDraft?.status || "NO_REPLY"} />
            </div>
            <p className="mt-5 whitespace-pre-line text-base leading-7 text-zinc-800">{review.text || "Отзыв без текста."}</p>
          </section>

          <section className="rounded-md border border-line bg-white p-5 shadow-panel">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Черновик ответа</h2>
                <p className="mt-1 text-sm text-moss">Автоответ не отправляется сам: вы редактируете текст и подтверждаете вручную.</p>
              </div>
              {review.replyDraft?.template ? (
                <span className="rounded bg-teal-50 px-2 py-1 text-xs font-semibold text-sea">
                  {review.replyDraft.template.name}
                </span>
              ) : null}
            </div>
            <textarea
              className="min-h-[220px] w-full rounded-md border-line text-sm leading-6"
              placeholder="Сначала нажмите «Подобрать шаблон» или напишите ответ вручную"
              value={draftText}
              onChange={(event) => setDraftText(event.target.value)}
            />
            {review.replyDraft?.error ? (
              <p className="mt-3 rounded-md bg-red-50 p-3 text-sm font-semibold text-red-700">{review.replyDraft.error}</p>
            ) : null}
            {message ? <p className="mt-3 rounded-md bg-canvas p-3 text-sm font-semibold text-moss">{message}</p> : null}
          </section>
        </main>

        <aside className="space-y-4">
          <InfoPanel title="Avito ID" value={review.avitoReviewId} />
          <InfoPanel title="Товар" value={review.itemTitle || "Не указан"} />
          <InfoPanel title="Дата отзыва" value={review.avitoCreatedAt ? new Date(review.avitoCreatedAt).toLocaleString("ru-RU") : "Нет даты"} />
          <div className="rounded-md border border-line bg-white p-5 shadow-panel">
            <h2 className="font-semibold">Правило</h2>
            <p className="mt-3 text-sm leading-6 text-moss">
              Шаблон подбирается по диапазону рейтинга, затем по ключевым словам в отзыве и названии товара, затем по приоритету.
            </p>
          </div>
        </aside>
      </div>
    </>
  );
}

function InfoPanel({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-md border border-line bg-white p-5 shadow-panel">
      <p className="text-xs font-semibold uppercase text-moss">{title}</p>
      <p className="mt-2 break-words font-semibold">{value}</p>
    </div>
  );
}

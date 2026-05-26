"use client";

import Link from "next/link";
import { MessageSquareText, RefreshCw, Search, Star } from "lucide-react";
import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { ClientReview } from "@/lib/client-types";
import { Button, EmptyState, PageHeader, StatusPill, requestJson } from "@/components/ui-kit";

const filters = [
  { id: "new", label: "Новые" },
  { id: "draft", label: "Черновики" },
  { id: "sent", label: "Авто/отправлены" },
  { id: "failed", label: "Ошибки" },
  { id: "low", label: "Низкая оценка" },
  { id: "all", label: "Все" },
];

export function ReviewsPage({ initialReviews }: { initialReviews: ClientReview[] }) {
  const [reviews, setReviews] = useState(initialReviews);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("new");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const filtered = useMemo(() => {
    return reviews.filter((review) => {
      const text = `${review.authorName ?? ""} ${review.itemTitle ?? ""} ${review.text}`.toLowerCase();
      const matchesQuery = text.includes(query.toLowerCase());
      const draftStatus = review.replyDraft?.status;
      const matchesFilter =
        filter === "all" ||
        (filter === "new" && !review.replyDraft) ||
        (filter === "draft" && draftStatus === "DRAFT") ||
        (filter === "sent" && draftStatus === "SENT") ||
        (filter === "failed" && draftStatus === "FAILED") ||
        (filter === "low" && review.rating <= 2);
      return matchesQuery && matchesFilter;
    });
  }, [reviews, query, filter]);

  const averageRating = reviews.length ? (reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length).toFixed(1) : "0.0";
  const drafts = reviews.filter((review) => review.replyDraft?.status === "DRAFT").length;
  const sent = reviews.filter((review) => review.replyDraft?.status === "SENT").length;
  const failed = reviews.filter((review) => review.replyDraft?.status === "FAILED").length;

  async function sync() {
    setBusy(true);
    setMessage("");
    try {
      const result = await requestJson<{ ok: boolean; synced: number; drafts: number; autoSent?: number; message?: string }>(
        "/api/automation/sync-reviews",
        { method: "POST", body: JSON.stringify({ force: true }) },
      );
      const payload = await requestJson<{ reviews: ClientReview[] }>("/api/reviews");
      setReviews(payload.reviews);
      setMessage(
        result.ok
          ? `Синхронизировано: ${result.synced}, черновиков: ${result.drafts}, автоотправлено: ${result.autoSent ?? 0}`
          : result.message || "",
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось синхронизировать отзывы");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Отзывы Avito"
        title="Очередь ответов"
        actions={
          <Button tone="secondary" busy={busy} onClick={sync}>
            <RefreshCw className="h-4 w-4" />
            Синхронизировать
          </Button>
        }
      />
      <div className="space-y-4 p-4 xl:p-6">
        <div className="grid gap-3 md:grid-cols-4">
          <Metric label="Средний рейтинг" value={averageRating} icon={<Star className="h-5 w-5 text-honey" />} />
          <Metric label="Черновиков" value={drafts} />
          <Metric label="Отправлено" value={sent} />
          <Metric label="Ошибок" value={failed} danger={failed > 0} />
        </div>

        <div className="flex flex-col gap-3 rounded-md border border-line bg-white p-3 shadow-panel lg:flex-row lg:items-center lg:justify-between">
          <label className="relative block flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-moss" />
            <input
              className="h-10 w-full rounded-md border-line pl-9 text-sm"
              placeholder="Поиск по отзыву, автору или товару"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            {filters.map((item) => (
              <button
                key={item.id}
                className={`h-10 rounded-md px-3 text-sm font-semibold ${filter === item.id ? "bg-ink text-white" : "border border-line bg-white text-ink hover:bg-canvas"}`}
                type="button"
                onClick={() => setFilter(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {message ? <p className="rounded-md border border-line bg-white p-3 text-sm font-semibold text-moss">{message}</p> : null}

        {filtered.length ? (
          <div className="overflow-hidden rounded-md border border-line bg-white shadow-panel">
            <div className="grid grid-cols-[.7fr_1.1fr_1.4fr_.8fr] gap-3 border-b border-line bg-canvas px-4 py-3 text-xs font-semibold uppercase text-moss max-lg:hidden">
              <span>Рейтинг</span>
              <span>Клиент / товар</span>
              <span>Отзыв</span>
              <span>Ответ</span>
            </div>
            <div className="divide-y divide-line">
              {filtered.map((review) => (
                <Link
                  key={review.id}
                  className="grid gap-3 px-4 py-4 transition hover:bg-canvas lg:grid-cols-[.7fr_1.1fr_1.4fr_.8fr] lg:items-center"
                  href={`/reviews/${review.id}`}
                >
                  <Rating value={review.rating} />
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{review.authorName || "Покупатель Avito"}</p>
                    <p className="mt-1 truncate text-sm text-moss">{review.itemTitle || "Товар не указан"}</p>
                  </div>
                  <p className="line-clamp-2 text-sm text-zinc-700">{review.text || "Без текста"}</p>
                  <StatusPill status={review.replyDraft?.status || "NO_REPLY"} />
                </Link>
              ))}
            </div>
          </div>
        ) : (
          <EmptyState
            title="В этой очереди пока пусто"
            action={
              <Button busy={busy} onClick={sync}>
                <MessageSquareText className="h-4 w-4" />
                Получить отзывы
              </Button>
            }
          />
        )}
      </div>
    </>
  );
}

function Metric({ label, value, icon, danger = false }: { label: string; value: string | number; icon?: ReactNode; danger?: boolean }) {
  return (
    <div className="rounded-md border border-line bg-white p-4 shadow-panel">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-moss">{label}</p>
        {icon}
      </div>
      <p className={`mt-2 text-3xl font-semibold ${danger ? "text-signal" : "text-ink"}`}>{value}</p>
    </div>
  );
}

function Rating({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-lg font-semibold">{value}</span>
      <div className="flex">
        {Array.from({ length: 5 }).map((_, index) => (
          <Star key={index} className={`h-4 w-4 ${index < value ? "fill-honey text-honey" : "text-line"}`} />
        ))}
      </div>
    </div>
  );
}

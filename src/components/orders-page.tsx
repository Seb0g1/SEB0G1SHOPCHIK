"use client";

import Link from "next/link";
import { Clipboard, RefreshCw, Search, ShoppingBag } from "lucide-react";
import { useMemo, useState } from "react";
import type { ClientCustomerOrder } from "@/lib/client-types";
import { Button, EmptyState, PageHeader, StatusPill, formatMoney, requestJson } from "@/components/ui-kit";

const filters = [
  { id: "all", label: "Все" },
  { id: "NEW", label: "Новые" },
  { id: "NEEDS_SUPPLIER", label: "Назначить поставщика" },
  { id: "CONTACTED", label: "Связались" },
  { id: "DONE", label: "Готово" },
  { id: "ERROR", label: "Ошибки" },
];

export function OrdersPage({ initialOrders }: { initialOrders: ClientCustomerOrder[] }) {
  const [orders, setOrders] = useState(initialOrders);
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");

  const visible = useMemo(() => {
    const normalized = query.toLowerCase();
    return orders.filter((order) => {
      const taskStatus = order.supplierTask?.status ?? "NEEDS_SUPPLIER";
      const matchesFilter = filter === "all" || taskStatus === filter || order.status === filter;
      const haystack = `${order.avitoOrderId} ${order.itemTitle ?? ""} ${order.product?.title ?? ""} ${order.color ?? ""} ${order.size ?? ""} ${order.supplierTask?.supplier?.name ?? ""}`.toLowerCase();
      return matchesFilter && haystack.includes(normalized);
    });
  }, [orders, filter, query]);

  async function sync() {
    setBusy("sync");
    setMessage("");
    try {
      const result = await requestJson<{ ok: boolean; synced: number; tasks: number; message?: string }>("/api/automation/sync-orders", {
        method: "POST",
        body: JSON.stringify({ force: true }),
      });
      const payload = await requestJson<{ orders: ClientCustomerOrder[] }>("/api/orders");
      setOrders(payload.orders);
      setMessage(result.ok ? `Заказы синхронизированы: ${result.synced}, задач создано: ${result.tasks}` : result.message || "Orders API недоступен.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось синхронизировать заказы.");
    } finally {
      setBusy("");
    }
  }

  async function copyTask(order: ClientCustomerOrder) {
    const text = order.supplierTask?.generatedMessage ?? "";
    if (!text || !order.supplierTask) return;
    await navigator.clipboard.writeText(text);
    const payload = await requestJson<{ task: ClientCustomerOrder["supplierTask"] }>(`/api/supplier-tasks/${order.supplierTask.id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "COPIED" }),
    });
    setOrders(orders.map((item) => (item.id === order.id ? { ...item, supplierTask: payload.task } : item)));
    setMessage("Сообщение поставщику скопировано.");
  }

  return (
    <>
      <PageHeader
        eyebrow="Avito Orders API"
        title="Заказы"
        actions={
          <Button busy={busy === "sync"} onClick={sync}>
            <RefreshCw className="h-4 w-4" />
            Синхронизировать заказы
          </Button>
        }
      />
      <div className="space-y-4 p-4 xl:p-6">
        <div className="grid gap-3 md:grid-cols-4">
          <Metric label="Всего" value={orders.length} />
          <Metric label="Нужно написать" value={orders.filter((order) => ["NEW", "NEEDS_SUPPLIER"].includes(order.supplierTask?.status ?? "NEEDS_SUPPLIER")).length} />
          <Metric label="Связались" value={orders.filter((order) => order.supplierTask?.status === "CONTACTED").length} />
          <Metric label="Ошибки" value={orders.filter((order) => order.supplierTask?.status === "ERROR").length} danger />
        </div>

        <section className="rounded-md border border-line bg-white p-3 shadow-panel">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2">
              {filters.map((item) => (
                <button
                  key={item.id}
                  className={`h-9 rounded-md px-3 text-sm font-semibold ${filter === item.id ? "bg-sea text-white" : "border border-line bg-white text-ink hover:bg-canvas"}`}
                  type="button"
                  onClick={() => setFilter(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <label className="relative block w-full lg:w-80">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-moss" />
              <input className="h-10 w-full rounded-md border-line pl-9 text-sm" placeholder="Поиск по заказу, товару, поставщику" value={query} onChange={(event) => setQuery(event.target.value)} />
            </label>
          </div>
        </section>

        {message ? <p className="rounded-md border border-line bg-white p-3 text-sm font-semibold text-moss">{message}</p> : null}

        {visible.length ? (
          <div className="overflow-hidden rounded-md border border-line bg-white shadow-panel">
            <div className="grid grid-cols-[1fr_.8fr_.8fr_.8fr_.7fr] gap-3 border-b border-line bg-canvas px-4 py-3 text-xs font-semibold uppercase text-moss max-xl:hidden">
              <span>Заказ / товар</span>
              <span>Вариант</span>
              <span>Поставщик</span>
              <span>Сообщение</span>
              <span>Статус</span>
            </div>
            <div className="divide-y divide-line">
              {visible.map((order) => (
                <div key={order.id} className="grid gap-3 px-4 py-4 xl:grid-cols-[1fr_.8fr_.8fr_.8fr_.7fr] xl:items-center">
                  <Link className="min-w-0" href={`/orders/${order.id}`}>
                    <p className="font-semibold">#{order.avitoOrderId}</p>
                    <p className="mt-1 truncate text-sm text-moss">{order.itemTitle || order.product?.title || "Товар не сопоставлен"}</p>
                  </Link>
                  <p className="text-sm text-zinc-700">
                    {order.color || "цвет ?"} · {order.size || "размер ?"} · {order.quantity} шт · {formatMoney(order.price)} ₽
                  </p>
                  <p className="text-sm font-semibold">{order.supplierTask?.supplier?.name || "Нужно назначить"}</p>
                  <div className="flex flex-wrap gap-2">
                    <Button tone="secondary" disabled={!order.supplierTask?.generatedMessage || order.supplierTask.status === "NEEDS_SUPPLIER"} onClick={() => copyTask(order)}>
                      <Clipboard className="h-4 w-4" />
                      Копировать
                    </Button>
                  </div>
                  <StatusPill status={order.supplierTask?.status || "NEEDS_SUPPLIER"} />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <EmptyState
            title="Заказы пока не синхронизированы"
            action={
              <Button busy={busy === "sync"} onClick={sync}>
                <ShoppingBag className="h-4 w-4" />
                Получить заказы из Avito
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

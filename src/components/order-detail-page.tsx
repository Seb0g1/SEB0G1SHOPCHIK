"use client";

import Link from "next/link";
import { Clipboard, Save } from "lucide-react";
import { useState } from "react";
import type { ClientCustomerOrder, ClientSupplier } from "@/lib/client-types";
import { Button, PageHeader, SelectField, StatusPill, formatMoney, requestJson } from "@/components/ui-kit";

export function OrderDetailPage({ initialOrder, suppliers }: { initialOrder: ClientCustomerOrder; suppliers: ClientSupplier[] }) {
  const [order, setOrder] = useState(initialOrder);
  const [draft, setDraft] = useState(order.supplierTask?.generatedMessage ?? "");
  const [supplierId, setSupplierId] = useState(order.supplierTask?.supplierId ?? "");
  const [status, setStatus] = useState(order.supplierTask?.status ?? "NEEDS_SUPPLIER");
  const [notes, setNotes] = useState(order.supplierTask?.notes ?? "");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");

  function changeSupplier(nextSupplierId: string) {
    setSupplierId(nextSupplierId);
    const supplier = suppliers.find((item) => item.id === nextSupplierId);
    if (supplier && (!draft.trim() || draft.startsWith("Назначьте поставщика"))) {
      setDraft(renderLocalSupplierDraft(supplier.defaultMessageTemplate, order, supplier));
      setStatus("NEW");
    }
  }

  async function save() {
    if (!order.supplierTask) return;
    setBusy("save");
    setMessage("");
    try {
      const payload = await requestJson<{ task: NonNullable<ClientCustomerOrder["supplierTask"]> }>(`/api/supplier-tasks/${order.supplierTask.id}`, {
        method: "PATCH",
        body: JSON.stringify({ supplierId: supplierId || null, generatedMessage: draft, status, notes }),
      });
      setOrder({ ...order, supplierTask: payload.task });
      setMessage("Задача поставщику сохранена.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось сохранить задачу.");
    } finally {
      setBusy("");
    }
  }

  async function copy() {
    if (!order.supplierTask || !draft.trim()) return;
    await navigator.clipboard.writeText(draft);
    setStatus("COPIED");
    const payload = await requestJson<{ task: NonNullable<ClientCustomerOrder["supplierTask"]> }>(`/api/supplier-tasks/${order.supplierTask.id}`, {
      method: "PATCH",
      body: JSON.stringify({ generatedMessage: draft, status: "COPIED", notes }),
    });
    setOrder({ ...order, supplierTask: payload.task });
    setMessage("Черновик скопирован.");
  }

  return (
    <>
      <PageHeader
        eyebrow="Заказ Avito"
        title={`Заказ #${order.avitoOrderId}`}
        actions={
          <>
            <StatusPill status={order.supplierTask?.status || "NEEDS_SUPPLIER"} />
            <Button tone="secondary" busy={busy === "save"} onClick={save}>
              <Save className="h-4 w-4" />
              Сохранить
            </Button>
            <Button onClick={copy}>
              <Clipboard className="h-4 w-4" />
              Копировать сообщение
            </Button>
          </>
        }
      />
      <div className="grid gap-4 p-4 xl:grid-cols-[minmax(0,1fr)_360px] xl:p-6">
        <section className="space-y-4 rounded-md border border-line bg-white p-5 shadow-panel">
          <div className="grid gap-4 md:grid-cols-3">
            <Info label="Товар" value={order.itemTitle || order.product?.title || "Не сопоставлен"} />
            <Info label="Вариант" value={`${order.color || "цвет ?"} / ${order.size || "размер ?"}`} />
            <Info label="Цена" value={`${formatMoney(order.price)} ₽ · ${order.quantity} шт`} />
            <Info label="Покупатель" value={order.buyerName || "Не указан"} />
            <Info label="Доставка" value={order.deliveryText || "Нет данных"} />
            <Info label="Avito item id" value={order.avitoItemId || "Нет"} />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <SupplierSelect value={supplierId} suppliers={suppliers} onChange={changeSupplier} />
            <SelectField label="Статус связи" value={status} options={["NEW", "COPIED", "CONTACTED", "DONE", "CANCELLED", "ERROR", "NEEDS_SUPPLIER"]} onChange={setStatus} />
          </div>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-moss">Черновик сообщения поставщику</span>
            <textarea className="min-h-[220px] w-full rounded-md border-line text-sm" value={draft} onChange={(event) => setDraft(event.target.value)} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-moss">Заметки по заказу</span>
            <textarea className="min-h-[100px] w-full rounded-md border-line text-sm" value={notes} onChange={(event) => setNotes(event.target.value)} />
          </label>
          {message ? <p className="rounded-md border border-line bg-canvas p-3 text-sm font-semibold text-moss">{message}</p> : null}
        </section>

        <aside className="space-y-4">
          <div className="rounded-md border border-line bg-white p-4 shadow-panel">
            <p className="text-sm font-semibold text-moss">Выбранный поставщик</p>
            <p className="mt-2 font-semibold">{suppliers.find((item) => item.id === supplierId)?.name || order.supplierTask?.supplier?.name || "Не назначен"}</p>
            <p className="mt-2 text-sm text-moss">{suppliers.find((item) => item.id === supplierId)?.telegram || suppliers.find((item) => item.id === supplierId)?.whatsapp || "Контакты смотрите в справочнике"}</p>
          </div>
          <Link className="block text-sm font-semibold text-sea" href="/orders">
            Вернуться к заказам
          </Link>
        </aside>
      </div>
    </>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-line bg-canvas p-4">
      <p className="text-xs font-semibold uppercase text-moss">{label}</p>
      <p className="mt-2 break-words font-semibold">{value}</p>
    </div>
  );
}

function SupplierSelect({ value, suppliers, onChange }: { value: string; suppliers: ClientSupplier[]; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-moss">Поставщик</span>
      <select className="h-10 w-full rounded-md border-line bg-white text-sm" value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Не назначен</option>
        {suppliers.map((supplier) => (
          <option key={supplier.id} value={supplier.id}>
            {supplier.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function renderLocalSupplierDraft(template: string, order: ClientCustomerOrder, supplier: ClientSupplier) {
  const values: Record<string, string> = {
    supplierName: supplier.name,
    contactName: supplier.contactName ?? "",
    orderId: order.avitoOrderId,
    itemTitle: order.itemTitle || order.product?.title || "",
    color: order.color || "не указан",
    size: order.size || "не указан",
    quantity: String(order.quantity),
    price: formatMoney(order.price),
    buyerName: order.buyerName || "",
    deliveryText: order.deliveryText || "",
    shopName: "SEB0G1SHOPCHIK",
    brand: order.product?.brand || "",
  };
  return template.replace(/\{([a-zA-Z]+)\}/g, (_, key: string) => values[key] ?? "").trim();
}

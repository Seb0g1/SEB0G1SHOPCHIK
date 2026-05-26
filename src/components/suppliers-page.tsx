"use client";

import { Plus, Save, Trash2, Truck } from "lucide-react";
import { useMemo, useState } from "react";
import type { ClientSupplier } from "@/lib/client-types";
import { Button, EmptyState, PageHeader, TextField, requestJson } from "@/components/ui-kit";

const emptyForm = {
  name: "",
  contactName: "",
  phone: "",
  whatsapp: "",
  telegram: "",
  website: "",
  notes: "",
  defaultMessageTemplate:
    "Здравствуйте! Нужен товар для заказа Avito #{orderId}: {itemTitle}. Цвет: {color}, размер: {size}, количество: {quantity}. Подтвердите наличие, цену и отправку.",
  active: true,
};

export function SuppliersPage({ initialSuppliers }: { initialSuppliers: ClientSupplier[] }) {
  const [suppliers, setSuppliers] = useState(initialSuppliers);
  const [selectedId, setSelectedId] = useState(initialSuppliers[0]?.id ?? "");
  const [form, setForm] = useState(initialSuppliers[0] ? supplierToForm(initialSuppliers[0]) : emptyForm);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");

  const selected = useMemo(() => suppliers.find((supplier) => supplier.id === selectedId) ?? null, [suppliers, selectedId]);

  function selectSupplier(supplier: ClientSupplier) {
    setSelectedId(supplier.id);
    setForm(supplierToForm(supplier));
    setMessage("");
  }

  function newSupplier() {
    setSelectedId("");
    setForm(emptyForm);
    setMessage("");
  }

  async function save() {
    setBusy("save");
    setMessage("");
    try {
      const payload = await requestJson<{ supplier: ClientSupplier }>(selectedId ? `/api/suppliers/${selectedId}` : "/api/suppliers", {
        method: selectedId ? "PATCH" : "POST",
        body: JSON.stringify(form),
      });
      const next = selectedId ? suppliers.map((item) => (item.id === selectedId ? payload.supplier : item)) : [payload.supplier, ...suppliers];
      setSuppliers(next);
      setSelectedId(payload.supplier.id);
      setForm(supplierToForm(payload.supplier));
      setMessage("Поставщик сохранен.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось сохранить поставщика.");
    } finally {
      setBusy("");
    }
  }

  async function remove() {
    if (!selectedId) return;
    setBusy("delete");
    setMessage("");
    try {
      await requestJson(`/api/suppliers/${selectedId}`, { method: "DELETE" });
      const next = suppliers.filter((item) => item.id !== selectedId);
      setSuppliers(next);
      setSelectedId(next[0]?.id ?? "");
      setForm(next[0] ? supplierToForm(next[0]) : emptyForm);
      setMessage("Поставщик удален.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось удалить поставщика.");
    } finally {
      setBusy("");
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Справочник"
        title="Поставщики"
        actions={
          <Button onClick={newSupplier}>
            <Plus className="h-4 w-4" />
            Новый поставщик
          </Button>
        }
      />
      <div className="grid gap-4 p-4 xl:grid-cols-[360px_minmax(0,1fr)] xl:p-6">
        <section className="rounded-md border border-line bg-white shadow-panel">
          <div className="border-b border-line p-4">
            <p className="font-semibold">Контакты для заказов</p>
            <p className="mt-1 text-sm text-moss">Поставщик выбирается у товара или у конкретного цвета.</p>
          </div>
          {suppliers.length ? (
            <div className="divide-y divide-line">
              {suppliers.map((supplier) => (
                <button
                  key={supplier.id}
                  className={`block w-full px-4 py-4 text-left transition ${supplier.id === selectedId ? "bg-teal-50" : "hover:bg-canvas"}`}
                  type="button"
                  onClick={() => selectSupplier(supplier)}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold">{supplier.name}</p>
                    <span className={`rounded px-2 py-1 text-xs font-semibold ${supplier.active ? "bg-emerald-50 text-emerald-700" : "bg-zinc-100 text-zinc-600"}`}>
                      {supplier.active ? "ACTIVE" : "OFF"}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-sm text-moss">{supplier.telegram || supplier.whatsapp || supplier.phone || supplier.website || "Контакты не заполнены"}</p>
                </button>
              ))}
            </div>
          ) : (
            <EmptyState title="Поставщиков пока нет" action={<Button onClick={newSupplier}>Добавить первого</Button>} />
          )}
        </section>

        <section className="rounded-md border border-line bg-white p-5 shadow-panel">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-moss">{selected ? "Редактирование" : "Новый контакт"}</p>
              <h2 className="mt-1 text-xl font-semibold">{form.name || "Поставщик"}</h2>
            </div>
            <Truck className="h-8 w-8 text-sea" />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <TextField label="Название поставщика" value={form.name} onChange={(name) => setForm({ ...form, name })} />
            <TextField label="Контактное лицо" value={form.contactName} onChange={(contactName) => setForm({ ...form, contactName })} />
            <TextField label="Телефон" value={form.phone} onChange={(phone) => setForm({ ...form, phone })} />
            <TextField label="WhatsApp" value={form.whatsapp} onChange={(whatsapp) => setForm({ ...form, whatsapp })} />
            <TextField label="Telegram" value={form.telegram} onChange={(telegram) => setForm({ ...form, telegram })} />
            <TextField label="Сайт / ссылка" value={form.website} onChange={(website) => setForm({ ...form, website })} />
            <label className="block md:col-span-2">
              <span className="mb-1 block text-xs font-semibold text-moss">Шаблон сообщения поставщику</span>
              <textarea
                className="min-h-[130px] w-full rounded-md border-line text-sm"
                value={form.defaultMessageTemplate}
                onChange={(event) => setForm({ ...form, defaultMessageTemplate: event.target.value })}
              />
              <span className="mt-1 block text-xs text-moss">Переменные: {"{orderId}"}, {"{itemTitle}"}, {"{color}"}, {"{size}"}, {"{quantity}"}, {"{price}"}, {"{deliveryText}"}.</span>
            </label>
            <label className="block md:col-span-2">
              <span className="mb-1 block text-xs font-semibold text-moss">Заметки</span>
              <textarea className="min-h-[90px] w-full rounded-md border-line text-sm" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
            </label>
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input className="rounded border-line text-sea" checked={form.active} type="checkbox" onChange={(event) => setForm({ ...form, active: event.target.checked })} />
              Активный поставщик
            </label>
          </div>
          <div className="mt-6 flex flex-wrap gap-2 border-t border-line pt-4">
            <Button busy={busy === "save"} onClick={save}>
              <Save className="h-4 w-4" />
              Сохранить
            </Button>
            {selectedId ? (
              <Button tone="danger" busy={busy === "delete"} onClick={remove}>
                <Trash2 className="h-4 w-4" />
                Удалить
              </Button>
            ) : null}
          </div>
          {message ? <p className="mt-4 rounded-md border border-line bg-canvas p-3 text-sm font-semibold text-moss">{message}</p> : null}
        </section>
      </div>
    </>
  );
}

function supplierToForm(supplier: ClientSupplier) {
  return {
    name: supplier.name,
    contactName: supplier.contactName ?? "",
    phone: supplier.phone ?? "",
    whatsapp: supplier.whatsapp ?? "",
    telegram: supplier.telegram ?? "",
    website: supplier.website ?? "",
    notes: supplier.notes,
    defaultMessageTemplate: supplier.defaultMessageTemplate,
    active: supplier.active,
  };
}

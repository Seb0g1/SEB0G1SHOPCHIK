"use client";

import Link from "next/link";
import { Filter, PackagePlus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import type { ClientProduct } from "@/lib/client-types";
import { Button, EmptyState, PageHeader, SelectField, StatusPill, formatMoney, requestJson } from "@/components/ui-kit";

const filters = [
  { id: "all", label: "Все" },
  { id: "DRAFT", label: "Черновики" },
  { id: "ERROR", label: "Ошибки" },
  { id: "READY", label: "Готовые" },
  { id: "READY_FOR_API", label: "Готовы к API" },
  { id: "no-photo", label: "Нет фото" },
  { id: "no-category", label: "Нет категории" },
];

export function ProductsPage({ products }: { products: ClientProduct[] }) {
  const [items, setItems] = useState(products);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [bulk, setBulk] = useState({ color: "", mode: "SET", value: 0, rounding: "NONE" });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const colors = useMemo(() => [...new Set(items.flatMap((product) => product.variants.map((variant) => variant.color)).filter(Boolean))], [items]);
  const filtered = useMemo(() => {
    return items.filter((product) => {
      const matchesQuery = `${product.title} ${product.brand ?? ""} ${product.avitoCategoryName ?? ""}`.toLowerCase().includes(query.toLowerCase());
      const matchesFilter =
        filter === "all" ||
        product.status === filter ||
        (filter === "no-photo" && product.photos.length === 0) ||
        (filter === "no-category" && !product.avitoCategorySlug);
      return matchesQuery && matchesFilter;
    });
  }, [items, query, filter]);

  const totalVariants = items.reduce((sum, product) => sum + product.variants.length, 0);
  const activeVariants = items.reduce((sum, product) => sum + product.variants.filter((variant) => variant.stockQty > 0).length, 0);
  const needsSync = items.reduce((sum, product) => sum + product.variants.filter((variant) => variant.needsSync).length, 0);

  async function applyBulkPrice() {
    setBusy(true);
    setNotice("");
    try {
      const result = await requestJson<{ preview: { count: number } }>("/api/bulk-price/apply", {
        method: "POST",
        body: JSON.stringify({
          productIds: filtered.map((product) => product.id),
          colors: bulk.color ? [bulk.color] : undefined,
          mode: bulk.mode,
          value: bulk.value,
          rounding: bulk.rounding,
        }),
      });
      const payload = await requestJson<{ products: ClientProduct[] }>("/api/products");
      setItems(payload.products);
      setNotice(`Цены обновлены: ${result.preview.count} вариантов.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Не удалось обновить цены");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Каталог"
        title="Товары Avito"
        actions={
          <Link href="/products/new">
            <Button>
              <PackagePlus className="h-4 w-4" />
              Новый товар
            </Button>
          </Link>
        }
      />
      <div className="space-y-4 p-4 xl:p-6">
        <div className="grid gap-3 md:grid-cols-4">
          <Metric label="Товаров" value={items.length} />
          <Metric label="Активных вариантов" value={activeVariants} hint={`${totalVariants} всего`} />
          <Metric label="К синхронизации" value={needsSync} />
          <Metric label="Ошибки" value={items.filter((product) => product.status === "ERROR").length} />
        </div>

        <div className="flex flex-col gap-3 rounded-md border border-line bg-white p-3 shadow-panel lg:flex-row lg:items-center lg:justify-between">
          <label className="relative block flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-moss" />
            <input
              className="h-10 w-full rounded-md border-line pl-9 text-sm"
              placeholder="Поиск по названию, бренду или категории"
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

        <section className="grid gap-3 rounded-md border border-line bg-white p-4 shadow-panel md:grid-cols-5">
          <SelectField label="Цвет" value={bulk.color} options={["", ...colors]} onChange={(color) => setBulk({ ...bulk, color })} />
          <SelectField label="Операция" value={bulk.mode} options={["SET", "ADD", "PERCENT"]} onChange={(mode) => setBulk({ ...bulk, mode })} />
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-moss">Значение</span>
            <input className="h-10 w-full rounded-md border-line bg-white text-sm" type="number" value={bulk.value} onChange={(event) => setBulk({ ...bulk, value: Number(event.target.value) })} />
          </label>
          <SelectField label="Округление" value={bulk.rounding} options={["NONE", "TO_9", "TO_99"]} onChange={(rounding) => setBulk({ ...bulk, rounding })} />
          <div className="flex items-end">
            <Button className="w-full" busy={busy} disabled={!filtered.length} onClick={applyBulkPrice}>
              Массово изменить
            </Button>
          </div>
          <p className="text-sm text-moss md:col-span-5">Операция применяется к текущей выдаче каталога. Можно выбрать цвет, например белый или черный, и изменить цену у всех размеров.</p>
        </section>

        {notice ? <p className="rounded-md border border-line bg-white p-3 text-sm font-semibold text-moss">{notice}</p> : null}

        {filtered.length ? (
          <div className="overflow-hidden rounded-md border border-line bg-white shadow-panel">
            <div className="grid grid-cols-[1.5fr_1fr_.6fr_.6fr_.7fr] gap-3 border-b border-line bg-canvas px-4 py-3 text-xs font-semibold uppercase text-moss max-lg:hidden">
              <span>Товар</span>
              <span>Категория</span>
              <span>Варианты</span>
              <span>Остаток</span>
              <span>Статус</span>
            </div>
            <div className="divide-y divide-line">
              {filtered.map((product) => (
                <Link key={product.id} className="grid gap-3 px-4 py-4 transition hover:bg-canvas lg:grid-cols-[1.5fr_1fr_.6fr_.6fr_.7fr] lg:items-center" href={`/products/${product.id}`}>
                  <div className="flex min-w-0 items-center gap-3">
                    <ProductThumb product={product} />
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{product.title}</p>
                      <p className="mt-1 text-sm text-moss">{product.brand || "Без бренда"} · {formatMoney(product.basePrice)} ₽</p>
                    </div>
                  </div>
                  <p className="text-sm text-moss">{product.avitoCategoryName || product.productType || "Категория не выбрана"}</p>
                  <p className="text-sm font-semibold">{product.variants.length}</p>
                  <p className="text-sm font-semibold">{product.variants.reduce((sum, variant) => sum + variant.stockQty, 0)}</p>
                  <StatusPill status={product.status} />
                </Link>
              ))}
            </div>
          </div>
        ) : (
          <EmptyState
            title="Товары не найдены"
            action={
              <Link href="/products/new">
                <Button>
                  <PackagePlus className="h-4 w-4" />
                  Новый товар
                </Button>
              </Link>
            }
          />
        )}
      </div>
    </>
  );
}

function Metric({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="rounded-md border border-line bg-white p-4 shadow-panel">
      <p className="text-sm font-semibold text-moss">{label}</p>
      <div className="mt-2 flex items-end gap-2">
        <span className="text-3xl font-semibold">{value}</span>
        {hint ? <span className="pb-1 text-sm text-moss">{hint}</span> : null}
      </div>
    </div>
  );
}

function ProductThumb({ product }: { product: ClientProduct }) {
  const photo = product.photos[0];
  if (photo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img className="h-12 w-12 rounded-md border border-line object-cover" src={photo.publicUrl} alt={product.title} />
    );
  }
  return (
    <div className="flex h-12 w-12 items-center justify-center rounded-md border border-line bg-canvas text-moss">
      <Filter className="h-5 w-5" />
    </div>
  );
}

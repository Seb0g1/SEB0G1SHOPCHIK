"use client";

import Link from "next/link";
import { Filter, PackagePlus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import type { ClientProduct } from "@/lib/client-types";
import { Button, EmptyState, PageHeader, StatusPill, formatMoney } from "@/components/ui-kit";

const filters = [
  { id: "all", label: "Все" },
  { id: "DRAFT", label: "Черновики" },
  { id: "ERROR", label: "Ошибки" },
  { id: "READY", label: "Готовые" },
  { id: "no-photo", label: "Нет фото" },
  { id: "no-category", label: "Нет категории" },
];

export function ProductsPage({ products }: { products: ClientProduct[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");

  const filtered = useMemo(() => {
    return products.filter((product) => {
      const matchesQuery = `${product.title} ${product.brand ?? ""} ${product.avitoCategoryName ?? ""}`
        .toLowerCase()
        .includes(query.toLowerCase());
      const matchesFilter =
        filter === "all" ||
        product.status === filter ||
        (filter === "no-photo" && product.photos.length === 0) ||
        (filter === "no-category" && !product.avitoCategorySlug);
      return matchesQuery && matchesFilter;
    });
  }, [products, query, filter]);

  const totalVariants = products.reduce((sum, product) => sum + product.variants.length, 0);
  const activeVariants = products.reduce(
    (sum, product) => sum + product.variants.filter((variant) => variant.stockQty > 0).length,
    0,
  );
  const errors = products.filter((product) => product.status === "ERROR").length;

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
        <div className="grid gap-3 md:grid-cols-3">
          <Metric label="Товаров" value={products.length} />
          <Metric label="Активных вариантов" value={activeVariants} hint={`${totalVariants} всего`} />
          <Metric label="Требуют внимания" value={errors} />
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
                className={`h-10 rounded-md px-3 text-sm font-semibold ${
                  filter === item.id ? "bg-ink text-white" : "border border-line bg-white text-ink hover:bg-canvas"
                }`}
                type="button"
                onClick={() => setFilter(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

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
                <Link
                  key={product.id}
                  className="grid gap-3 px-4 py-4 transition hover:bg-canvas lg:grid-cols-[1.5fr_1fr_.6fr_.6fr_.7fr] lg:items-center"
                  href={`/products/${product.id}`}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <ProductThumb product={product} />
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{product.title}</p>
                      <p className="mt-1 text-sm text-moss">
                        {product.brand || "Без бренда"} · {formatMoney(product.basePrice)} ₽
                      </p>
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

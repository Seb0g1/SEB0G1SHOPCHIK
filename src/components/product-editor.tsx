"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ImagePlus, PackagePlus, Save, Send, Sparkles, UploadCloud } from "lucide-react";
import type { ClientProduct } from "@/lib/client-types";
import type { AvitoCatalogField, AvitoCategoryNode } from "@/lib/avito/catalog";
import { Button, NumberField, PageHeader, StatusPill, TextField, requestJson } from "@/components/ui-kit";
import { DynamicFields, SizePicker } from "@/components/product-wizard";

type Tab = "params" | "photos" | "variants" | "description" | "publication";

export function ProductEditor({ initialProduct }: { initialProduct: ClientProduct }) {
  const [product, setProduct] = useState(initialProduct);
  const [tree, setTree] = useState<AvitoCategoryNode[]>([]);
  const [fields, setFields] = useState<AvitoCatalogField[]>([]);
  const [tab, setTab] = useState<Tab>("params");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [variantDraft, setVariantDraft] = useState({
    color: "Черный",
    sizes: ["S", "M", "L", "XL"],
    price: product.basePrice,
    stockQty: 2,
  });
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const colors = useMemo(() => [...new Set(product.variants.map((variant) => variant.color))], [product.variants]);
  const flatCategories = useMemo(() => flattenCategories(tree), [tree]);
  const activeVariants = product.variants.filter((variant) => variant.stockQty > 0 && variant.publicationStatus !== "SUSPENDED");

  useEffect(() => {
    requestJson<{ data: AvitoCategoryNode[] }>("/api/avito/catalog/tree")
      .then((payload) => setTree(payload.data))
      .catch(() => setTree([]));
  }, []);

  useEffect(() => {
    if (!product.avitoCategorySlug) return;
    requestJson<{ data: AvitoCatalogField[] }>(
      `/api/avito/catalog/nodes/${encodeURIComponent(product.avitoCategorySlug)}/fields`,
    )
      .then((payload) => setFields(payload.data))
      .catch(() => setFields([]));
  }, [product.avitoCategorySlug]);

  async function saveProduct() {
    await withBusy("save", async () => {
      const payload = await requestJson<{ product: ClientProduct }>(`/api/products/${product.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: product.title,
          brand: product.brand,
          basePrice: product.basePrice,
          description: product.description,
          generatedDescription: product.generatedDescription,
          avitoCategorySlug: product.avitoCategorySlug,
          avitoCategoryName: product.avitoCategoryName,
          avitoFields: product.avitoFields,
          status: product.status,
          variants: product.variants,
        }),
      });
      setProduct(payload.product);
      setMessage("Товар сохранен.");
    });
  }

  async function uploadPhotos() {
    const files = Array.from(fileInputRef.current?.files ?? []);
    if (!files.length) return;
    await withBusy("photos", async () => {
      const data = new FormData();
      data.append("color", colors[0] || "Белый");
      files.forEach((file) => data.append("files", file));
      const response = await fetch(`/api/products/${product.id}/photos`, { method: "POST", body: data });
      if (!response.ok) throw new Error(await response.text());
      const payload = (await response.json()) as { product: ClientProduct };
      setProduct(payload.product);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setMessage("Фото загружены.");
    });
  }

  async function generateVariants() {
    await withBusy("variants", async () => {
      const payload = await requestJson<{ product: ClientProduct }>(`/api/products/${product.id}/variants/generate`, {
        method: "POST",
        body: JSON.stringify(variantDraft),
      });
      setProduct(payload.product);
      setMessage("Варианты добавлены.");
    });
  }

  async function generateDescription() {
    await withBusy("description", async () => {
      const payload = await requestJson<{ product: ClientProduct }>(`/api/products/${product.id}/description/generate`, {
        method: "POST",
      });
      setProduct(payload.product);
      setMessage("Описание обновлено.");
    });
  }

  async function submit() {
    await withBusy("submit", async () => {
      const payload = await requestJson<{ errors: string[]; warnings: string[] }>(`/api/publications/${product.id}/submit`, {
        method: "POST",
      });
      const refreshed = await requestJson<{ product: ClientProduct }>(`/api/products/${product.id}`);
      setProduct(refreshed.product);
      setTab("publication");
      setMessage(payload.errors[0] || payload.warnings[0] || "Запрос отправлен в Avito.");
    });
  }

  async function withBusy(name: string, fn: () => Promise<void>) {
    setBusy(name);
    setMessage("");
    try {
      await fn();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Ошибка операции");
    } finally {
      setBusy("");
    }
  }

  return (
    <>
      <PageHeader
        eyebrow={product.avitoCategoryName || "Товар"}
        title={product.title}
        actions={
          <>
            <StatusPill status={product.status} />
            <Button tone="secondary" busy={busy === "save"} onClick={saveProduct}>
              <Save className="h-4 w-4" />
              Сохранить
            </Button>
            <Button busy={busy === "submit"} onClick={submit}>
              <Send className="h-4 w-4" />
              Проверить и отправить
            </Button>
          </>
        }
      />
      <div className="p-4 xl:p-6">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <section className="overflow-hidden rounded-md border border-line bg-white shadow-panel">
            <div className="flex flex-wrap gap-1 border-b border-line bg-canvas p-2">
              {[
                ["params", "Параметры"],
                ["photos", "Фото"],
                ["variants", "Варианты"],
                ["description", "Описание"],
                ["publication", "Публикация"],
              ].map(([id, label]) => (
                <button
                  key={id}
                  className={`h-10 rounded-md px-3 text-sm font-semibold ${
                    tab === id ? "bg-white text-ink shadow-panel" : "text-moss hover:bg-white"
                  }`}
                  type="button"
                  onClick={() => setTab(id as Tab)}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="p-5">
              {tab === "params" ? (
                <div className="space-y-5">
                  <div className="grid gap-4 md:grid-cols-3">
                    <TextField label="Название" value={product.title} onChange={(title) => setProduct({ ...product, title })} />
                    <TextField label="Бренд" value={product.brand ?? ""} onChange={(brand) => setProduct({ ...product, brand })} />
                    <NumberField label="Цена" value={product.basePrice} onChange={(basePrice) => setProduct({ ...product, basePrice })} />
                  </div>
                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold text-moss">Категория Avito</span>
                    <select
                      className="h-10 w-full rounded-md border-line bg-white text-sm"
                      value={product.avitoCategorySlug ?? ""}
                      onChange={(event) => {
                        const category = flatCategories.find((item) => item.slug === event.target.value);
                        setProduct({
                          ...product,
                          avitoCategorySlug: event.target.value || null,
                          avitoCategoryName: category?.path ?? null,
                          avitoFields: {},
                        });
                      }}
                    >
                      <option value="">Выберите категорию</option>
                      {flatCategories.map((item) => (
                        <option key={item.slug} value={item.slug}>
                          {item.path}
                        </option>
                      ))}
                    </select>
                  </label>
                  <DynamicFields
                    fields={fields}
                    values={product.avitoFields}
                    onChange={(avitoFields) => setProduct({ ...product, avitoFields })}
                  />
                </div>
              ) : null}

              {tab === "photos" ? (
                <div className="space-y-4">
                  <label className="flex min-h-[180px] cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-line bg-canvas p-6 text-center">
                    <ImagePlus className="h-10 w-10 text-sea" />
                    <span className="mt-3 text-sm font-semibold">Загрузить фото</span>
                    <input ref={fileInputRef} className="mt-4 block text-sm" type="file" accept="image/*" multiple />
                  </label>
                  <Button busy={busy === "photos"} onClick={uploadPhotos}>
                    <UploadCloud className="h-4 w-4" />
                    Загрузить
                  </Button>
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                    {product.photos.map((photo) => (
                      <div key={photo.id} className="overflow-hidden rounded-md border border-line">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img className="aspect-square w-full object-cover" src={photo.publicUrl} alt={photo.originalName} />
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {tab === "variants" ? (
                <div className="space-y-5">
                  <div className="grid gap-4 rounded-md border border-line bg-canvas p-4 md:grid-cols-4">
                    <TextField label="Цвет" value={variantDraft.color} onChange={(color) => setVariantDraft({ ...variantDraft, color })} />
                    <NumberField label="Цена" value={variantDraft.price} onChange={(price) => setVariantDraft({ ...variantDraft, price })} />
                    <NumberField label="Остаток" value={variantDraft.stockQty} onChange={(stockQty) => setVariantDraft({ ...variantDraft, stockQty })} />
                    <div className="flex items-end">
                      <Button busy={busy === "variants"} className="w-full" onClick={generateVariants}>
                        <PackagePlus className="h-4 w-4" />
                        Добавить
                      </Button>
                    </div>
                    <div className="md:col-span-4">
                      <SizePicker selected={variantDraft.sizes} onChange={(sizes) => setVariantDraft({ ...variantDraft, sizes })} />
                    </div>
                  </div>
                  <div className="overflow-x-auto rounded-md border border-line">
                    <table className="min-w-[720px] w-full divide-y divide-line text-sm">
                      <thead className="bg-canvas text-xs uppercase text-moss">
                        <tr>
                          <th className="px-3 py-2 text-left">SKU</th>
                          <th className="px-3 py-2 text-left">Цвет</th>
                          <th className="px-3 py-2 text-left">Размер</th>
                          <th className="px-3 py-2 text-left">Цена</th>
                          <th className="px-3 py-2 text-left">Остаток</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line">
                        {product.variants.map((variant) => (
                          <tr key={variant.id}>
                            <td className="px-3 py-2 font-mono text-xs">{variant.sku}</td>
                            <td className="px-3 py-2">{variant.color}</td>
                            <td className="px-3 py-2">{variant.size}</td>
                            <td className="px-3 py-2">{variant.price}</td>
                            <td className="px-3 py-2">{variant.stockQty}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}

              {tab === "description" ? (
                <div className="space-y-4">
                  <Button tone="secondary" busy={busy === "description"} onClick={generateDescription}>
                    <Sparkles className="h-4 w-4" />
                    Сгенерировать
                  </Button>
                  <textarea
                    className="min-h-[220px] w-full rounded-md border-line text-sm"
                    value={product.generatedDescription || product.description}
                    onChange={(event) =>
                      setProduct({ ...product, generatedDescription: event.target.value, description: event.target.value })
                    }
                  />
                </div>
              ) : null}

              {tab === "publication" ? (
                <div className="space-y-4">
                  <div className="rounded-md border border-line bg-canvas p-4">
                    <p className="font-semibold">Готовность</p>
                    <p className="mt-2 text-sm text-moss">
                      {activeVariants.length} активных вариантов · {product.photos.length} фото ·{" "}
                      {product.lastApiSyncAt ? new Date(product.lastApiSyncAt).toLocaleString("ru-RU") : "синхронизации не было"}
                    </p>
                  </div>
                  {product.publicationErrors.length ? (
                    <div className="rounded-md border border-red-100 bg-red-50 p-4 text-sm text-red-700">
                      {product.publicationErrors.map((error) => (
                        <p key={error}>{error}</p>
                      ))}
                    </div>
                  ) : null}
                  {product.publicationRuns.map((run) => (
                    <div key={run.id} className="rounded-md border border-line p-4">
                      <div className="flex items-center justify-between gap-3">
                        <StatusPill status={run.status} />
                        <span className="text-sm text-moss">{new Date(run.submittedAt).toLocaleString("ru-RU")}</span>
                      </div>
                      {[...run.errors, ...run.warnings].map((item) => (
                        <p key={item} className="mt-2 text-sm text-moss">
                          {item}
                        </p>
                      ))}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </section>

          <aside className="space-y-4">
            <div className="rounded-md border border-line bg-white p-4 shadow-panel">
              <p className="text-sm font-semibold text-moss">Категория</p>
              <p className="mt-2 font-semibold">{product.avitoCategoryName || "Не выбрана"}</p>
            </div>
            <div className="rounded-md border border-line bg-white p-4 shadow-panel">
              <p className="text-sm font-semibold text-moss">Показатели</p>
              <dl className="mt-3 space-y-2 text-sm">
                <Row label="Фото" value={product.photos.length} />
                <Row label="Варианты" value={product.variants.length} />
                <Row label="Активные" value={activeVariants.length} />
              </dl>
            </div>
            <Link className="block text-sm font-semibold text-sea" href="/products">
              Вернуться в каталог
            </Link>
          </aside>
        </div>
        {message ? <p className="fixed bottom-4 left-1/2 z-20 -translate-x-1/2 rounded-md bg-ink px-4 py-3 text-sm font-semibold text-white shadow-lg">{message}</p> : null}
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between border-b border-line pb-2 last:border-b-0">
      <dt className="text-moss">{label}</dt>
      <dd className="font-semibold">{value}</dd>
    </div>
  );
}

function flattenCategories(nodes: AvitoCategoryNode[]): AvitoCategoryNode[] {
  return nodes.flatMap((node) => [node, ...flattenCategories(node.children)]);
}

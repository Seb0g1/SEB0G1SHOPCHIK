"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ImagePlus, PackagePlus, Save, Send, Sparkles, Trash2, UploadCloud } from "lucide-react";
import type { ClientProduct, ClientSupplier } from "@/lib/client-types";
import type { AvitoCatalogField, AvitoCategoryNode } from "@/lib/avito/catalog";
import { displayVariantSize, findFieldByRole, isProductCoreField, isVariantField } from "@/lib/avito/field-utils";
import { describePublicationReportStatus } from "@/lib/publication-status";
import { Button, NumberField, PageHeader, SelectField, StatusPill, TextField, requestJson } from "@/components/ui-kit";
import { AvitoFieldControl, DynamicFields, LinkedSizePicker } from "@/components/product-wizard";
import { ExcelDownloadButton } from "@/components/excel-download-button";

type Tab = "params" | "photos" | "variants" | "description" | "publication";

export function ProductEditor({ initialProduct }: { initialProduct: ClientProduct }) {
  const router = useRouter();
  const [product, setProduct] = useState(initialProduct);
  const [tree, setTree] = useState<AvitoCategoryNode[]>([]);
  const [fields, setFields] = useState<AvitoCatalogField[]>([]);
  const [suppliers, setSuppliers] = useState<ClientSupplier[]>([]);
  const [tab, setTab] = useState<Tab>("params");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [photoColor, setPhotoColor] = useState(initialProduct.variants[0]?.color ?? "");
  const [bulkPrice, setBulkPrice] = useState({ color: "", mode: "SET", value: initialProduct.basePrice, rounding: "NONE" });
  const [variantDraft, setVariantDraft] = useState({
    color: initialProduct.variants[0]?.color ?? "",
    sizes: initialProduct.variants.length ? [...new Set(initialProduct.variants.map((variant) => variant.size))] : [],
    price: initialProduct.basePrice,
    stockQty: 2,
  });
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const colors = useMemo(
    () => [...new Set([...product.colorGroups.map((group) => group.avitoColorValue || group.color), ...product.variants.map((variant) => variant.color)].filter(Boolean))],
    [product.colorGroups, product.variants],
  );
  const flatCategories = useMemo(() => flattenCategories(tree), [tree]);
  const activeVariants = product.variants.filter((variant) => variant.stockQty > 0 && variant.publicationStatus !== "SUSPENDED");
  const brandField = findFieldByRole(fields, "brand");
  const colorField = findFieldByRole(fields, "color");
  const sizeField = findFieldByRole(fields, "size");
  const categoryFields = fields.filter((field) => !isVariantField(field) && !isProductCoreField(field));

  useEffect(() => {
    requestJson<{ suppliers: ClientSupplier[] }>("/api/suppliers")
      .then((payload) => setSuppliers(payload.suppliers.filter((supplier) => supplier.active)))
      .catch(() => setSuppliers([]));

    requestJson<{ data: AvitoCategoryNode[] }>("/api/avito/catalog/tree")
      .then((payload) => setTree(payload.data))
      .catch(() => setTree([]));
  }, []);

  useEffect(() => {
    if (!product.avitoCategorySlug) return;
    requestJson<{ data: AvitoCatalogField[] }>(`/api/avito/catalog/nodes/${encodeURIComponent(product.avitoCategorySlug)}/fields`)
      .then((payload) => setFields(payload.data))
      .catch(() => setFields([]));
  }, [product.avitoCategorySlug]);

  async function saveProduct() {
    await withBusy("save", async () => {
      const avitoFields = {
        ...product.avitoFields,
        ...(brandField ? { [brandField.key]: product.brand ?? "" } : {}),
      };
      const payload = await requestJson<{ product: ClientProduct }>(`/api/products/${product.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: product.title,
          brand: product.brand,
          supplierId: product.supplierId,
          basePrice: product.basePrice,
          description: product.description,
          generatedDescription: product.generatedDescription,
          avitoCategorySlug: product.avitoCategorySlug,
          avitoCategoryName: product.avitoCategoryName,
          avitoFields,
          status: product.status,
          variants: product.variants,
          colorGroups: product.colorGroups,
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
      data.append("color", photoColor || colors[0] || variantDraft.color || "Без цвета");
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
        body: JSON.stringify({
          ...variantDraft,
          color: variantDraft.color.trim() || "Без цвета",
          sizes: sizeField ? variantDraft.sizes : ["ONE_SIZE"],
        }),
      });
      setProduct(payload.product);
      setMessage("Варианты добавлены.");
    });
  }

  async function generateDescription() {
    await withBusy("description", async () => {
      const payload = await requestJson<{ product: ClientProduct }>(`/api/products/${product.id}/description/generate`, { method: "POST" });
      setProduct(payload.product);
      setMessage("Описание обновлено.");
    });
  }

  async function applyBulkPrice() {
    await withBusy("bulkPrice", async () => {
      const payload = await requestJson<{ preview: { count: number } }>(`/api/products/${product.id}/bulk-price/apply`, {
        method: "POST",
        body: JSON.stringify({
          colors: bulkPrice.color ? [bulkPrice.color] : undefined,
          mode: bulkPrice.mode,
          value: bulkPrice.value,
          rounding: bulkPrice.rounding,
        }),
      });
      const refreshed = await requestJson<{ product: ClientProduct }>(`/api/products/${product.id}`);
      setProduct(refreshed.product);
      setMessage(`Цены обновлены: ${payload.preview.count} вариантов.`);
    });
  }

  async function submit() {
    await withBusy("submit", async () => {
      const payload = await requestJson<{ errors: string[]; warnings: string[]; manualSetupRequired?: boolean; feedUrl?: string }>(`/api/publications/${product.id}/submit`, { method: "POST" });
      const refreshed = await requestJson<{ product: ClientProduct }>(`/api/products/${product.id}`);
      setProduct(refreshed.product);
      setTab("publication");
      setMessage(
        payload.errors[0] ||
          (payload.manualSetupRequired ? `Autoload API недоступен. Вставьте feed URL вручную в кабинете Avito: ${payload.feedUrl}` : payload.warnings[0]) ||
          "Запрос отправлен в Avito.",
      );
    });
  }

  async function removeProduct() {
    if (!window.confirm(`Удалить товар "${product.title}"? Это удалит варианты и фото товара.`)) return;
    await withBusy("delete", async () => {
      const response = await fetch(`/api/products/${product.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error(await response.text());
      router.push("/products");
      router.refresh();
    });
  }

  function patchVariant(id: string, patch: Partial<ClientProduct["variants"][number]>) {
    setProduct({
      ...product,
      variants: product.variants.map((variant) => (variant.id === id ? { ...variant, ...patch, needsSync: true } : variant)),
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
            <ExcelDownloadButton productIds={[product.id]} label="Скачать Excel для Авито" />
            <Button tone="secondary" busy={busy === "save"} onClick={saveProduct}>
              <Save className="h-4 w-4" />
              Сохранить
            </Button>
            <Button tone="danger" busy={busy === "delete"} onClick={removeProduct}>
              <Trash2 className="h-4 w-4" />
              Удалить товар
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
                ["variants", "Матрица"],
                ["description", "Описание"],
                ["publication", "Публикация"],
              ].map(([id, label]) => (
                <button
                  key={id}
                  className={`h-10 rounded-md px-3 text-sm font-semibold ${tab === id ? "bg-white text-ink shadow-panel" : "text-moss hover:bg-white"}`}
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
                    <NumberField label="Базовая цена" value={product.basePrice} onChange={(basePrice) => setProduct({ ...product, basePrice })} />
                    <SupplierSelect
                      label="Поставщик товара"
                      value={product.supplierId ?? ""}
                      suppliers={suppliers}
                      onChange={(supplierId) => setProduct({ ...product, supplierId: supplierId || null })}
                    />
                  </div>
                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold text-moss">Категория Avito</span>
                    <select
                      className="h-10 w-full rounded-md border-line bg-white text-sm"
                      value={product.avitoCategorySlug ?? ""}
                      onChange={(event) => {
                        const category = flatCategories.find((item) => item.slug === event.target.value);
                        setProduct({ ...product, avitoCategorySlug: event.target.value || null, avitoCategoryName: category?.path ?? null, avitoFields: {} });
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
                  <DynamicFields fields={categoryFields} values={product.avitoFields} onChange={(avitoFields) => setProduct({ ...product, avitoFields })} />
                </div>
              ) : null}

              {tab === "photos" ? (
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-[260px_minmax(0,1fr)]">
                    <SelectField label="Цвет фото" value={photoColor} options={["", ...colors]} onChange={setPhotoColor} />
                    <label className="flex min-h-[120px] cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-line bg-canvas p-6 text-center">
                      <ImagePlus className="h-10 w-10 text-sea" />
                      <span className="mt-3 text-sm font-semibold">Загрузить фото для выбранного цвета</span>
                      <input ref={fileInputRef} className="mt-4 block text-sm" type="file" accept="image/*" multiple />
                    </label>
                  </div>
                  <Button busy={busy === "photos"} onClick={uploadPhotos}>
                    <UploadCloud className="h-4 w-4" />
                    Загрузить
                  </Button>
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                    {product.photos.map((photo) => (
                      <div key={photo.id} className="overflow-hidden rounded-md border border-line">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img className="aspect-square w-full object-cover" src={photo.publicUrl} alt={photo.originalName} />
                        <p className="truncate px-2 py-1 text-xs text-moss">{photo.color || "общие"}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {tab === "variants" ? (
                <div className="space-y-5">
                  <div className="grid gap-4 rounded-md border border-line bg-canvas p-4 md:grid-cols-4">
                    {colorField ? (
                      <AvitoFieldControl field={colorField} value={variantDraft.color} onChange={(color) => setVariantDraft({ ...variantDraft, color })} />
                    ) : (
                      <TextField label="Цвет" value={variantDraft.color} onChange={(color) => setVariantDraft({ ...variantDraft, color })} />
                    )}
                    <NumberField label="Цена" value={variantDraft.price} onChange={(price) => setVariantDraft({ ...variantDraft, price })} />
                    <NumberField label="Остаток" value={variantDraft.stockQty} onChange={(stockQty) => setVariantDraft({ ...variantDraft, stockQty })} />
                    <div className="flex items-end">
                      <Button busy={busy === "variants"} className="w-full" onClick={generateVariants}>
                        <PackagePlus className="h-4 w-4" />
                        Добавить
                      </Button>
                    </div>
                    <div className="md:col-span-4">
                      {sizeField ? (
                        <LinkedSizePicker field={sizeField} selected={variantDraft.sizes} onChange={(sizes) => setVariantDraft({ ...variantDraft, sizes })} />
                      ) : (
                        <p className="rounded-md border border-line bg-white p-3 text-sm text-moss">Для этой категории Avito не вернул поле размера.</p>
                      )}
                    </div>
                  </div>

                  <div className="grid gap-4 rounded-md border border-line bg-canvas p-4 md:grid-cols-5">
                    <SelectField label="Цвет" value={bulkPrice.color} options={["", ...colors]} onChange={(color) => setBulkPrice({ ...bulkPrice, color })} />
                    <SelectField label="Операция" value={bulkPrice.mode} options={["SET", "ADD", "PERCENT"]} onChange={(mode) => setBulkPrice({ ...bulkPrice, mode })} />
                    <label className="block">
                      <span className="mb-1 block text-xs font-semibold text-moss">Значение</span>
                      <input
                        className="h-10 w-full rounded-md border-line bg-white text-sm"
                        type="number"
                        value={bulkPrice.value}
                        onChange={(event) => setBulkPrice({ ...bulkPrice, value: Number(event.target.value) })}
                      />
                    </label>
                    <SelectField label="Округление" value={bulkPrice.rounding} options={["NONE", "TO_9", "TO_99"]} onChange={(rounding) => setBulkPrice({ ...bulkPrice, rounding })} />
                    <div className="flex items-end">
                      <Button busy={busy === "bulkPrice"} className="w-full" onClick={applyBulkPrice}>
                        Обновить цены
                      </Button>
                    </div>
                  </div>

                  {product.colorGroups.length ? (
                    <div className="rounded-md border border-line bg-canvas p-4">
                      <p className="mb-3 font-semibold">Поставщики по цветам</p>
                      <div className="grid gap-3 md:grid-cols-2">
                        {product.colorGroups.map((group) => (
                          <SupplierSelect
                            key={group.id}
                            label={`${group.avitoColorValue || group.color}`}
                            value={group.supplierId ?? ""}
                            suppliers={suppliers}
                            onChange={(supplierId) =>
                              setProduct({
                                ...product,
                                colorGroups: product.colorGroups.map((item) => (item.id === group.id ? { ...item, supplierId: supplierId || null } : item)),
                              })
                            }
                          />
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="overflow-x-auto rounded-md border border-line">
                    <table className="min-w-[860px] w-full divide-y divide-line text-sm">
                      <thead className="bg-canvas text-xs uppercase text-moss">
                        <tr>
                          <th className="px-3 py-2 text-left">SKU</th>
                          <th className="px-3 py-2 text-left">Цвет</th>
                          <th className="px-3 py-2 text-left">Размер</th>
                          <th className="px-3 py-2 text-left">Цена</th>
                          <th className="px-3 py-2 text-left">Остаток</th>
                          <th className="px-3 py-2 text-left">Sync</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line">
                        {product.variants.map((variant) => (
                          <tr key={variant.id}>
                            <td className="px-3 py-2 font-mono text-xs">{variant.sku}</td>
                            <td className="px-3 py-2">{variant.color}</td>
                            <td className="px-3 py-2">{displayVariantSize(variant.size)}</td>
                            <td className="px-3 py-2">
                              <input
                                className="h-9 w-28 rounded-md border-line text-sm"
                                type="number"
                                value={variant.price}
                                onChange={(event) => patchVariant(variant.id, { price: Number(event.target.value) })}
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input
                                className="h-9 w-24 rounded-md border-line text-sm"
                                type="number"
                                value={variant.stockQty}
                                onChange={(event) => patchVariant(variant.id, { stockQty: Number(event.target.value) })}
                              />
                            </td>
                            <td className="px-3 py-2">
                              <StatusPill status={variant.needsSync ? "NEEDS_SYNC" : variant.publicationStatus} />
                            </td>
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
                    onChange={(event) => setProduct({ ...product, generatedDescription: event.target.value, description: event.target.value })}
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
                      <p className="mt-2 text-sm font-semibold text-moss">{describePublicationReportStatus(run.reportStatus)}</p>
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
                <Row label="Цвета" value={colors.length} />
                <Row label="Фото" value={product.photos.length} />
                <Row label="Варианты" value={product.variants.length} />
                <Row label="К синхронизации" value={product.variants.filter((variant) => variant.needsSync).length} />
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

function SupplierSelect({
  label,
  value,
  suppliers,
  onChange,
}: {
  label: string;
  value: string;
  suppliers: ClientSupplier[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-moss">{label}</span>
      <select className="h-10 w-full rounded-md border-line bg-white text-sm" value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Поставщик не назначен</option>
        {suppliers.map((supplier) => (
          <option key={supplier.id} value={supplier.id}>
            {supplier.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function flattenCategories(nodes: AvitoCategoryNode[]): AvitoCategoryNode[] {
  return nodes.flatMap((node) => [node, ...flattenCategories(node.children)]);
}

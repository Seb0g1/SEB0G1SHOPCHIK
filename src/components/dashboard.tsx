"use client";

import {
  CheckCircle2,
  Download,
  ExternalLink,
  ImagePlus,
  Loader2,
  PackagePlus,
  RefreshCw,
  Save,
  Send,
  Settings,
  Sparkles,
  UploadCloud,
} from "lucide-react";
import clsx from "clsx";
import { FormEvent, useMemo, useRef, useState } from "react";
import type { ClientAvitoSettings, ClientProduct, ClientVariant } from "@/lib/client-types";
import { CLOTHING_SIZES } from "@/lib/catalog";

type DashboardProps = {
  initialProducts: ClientProduct[];
  initialSettings: ClientAvitoSettings;
};

type Toast = {
  tone: "ok" | "warn" | "error";
  message: string;
};

const DEFAULT_COLOR = "Белый";

export function Dashboard({ initialProducts, initialSettings }: DashboardProps) {
  const [products, setProducts] = useState<ClientProduct[]>(initialProducts);
  const [settings, setSettings] = useState<ClientAvitoSettings>(initialSettings);
  const [secretDraft, setSecretDraft] = useState("");
  const [photoColor, setPhotoColor] = useState(DEFAULT_COLOR);
  const [selectedId, setSelectedId] = useState(initialProducts[0]?.id ?? "");
  const [toast, setToast] = useState<Toast | null>(null);
  const [busy, setBusy] = useState("");
  const [createForm, setCreateForm] = useState({
    title: "Футболка Nike Forza Nocta",
    brand: "Nike",
    basePrice: 4990,
    color: DEFAULT_COLOR,
    sizes: ["S", "M", "L", "XL"],
    stockQty: 2,
  });
  const [variantForm, setVariantForm] = useState({
    color: "Черный",
    sizes: ["S", "M", "L", "XL"],
    price: 4990,
    stockQty: 2,
  });
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const activeProduct = useMemo(
    () => products.find((product) => product.id === selectedId) ?? products[0] ?? null,
    [products, selectedId],
  );

  const colors = useMemo(() => {
    if (!activeProduct) return [DEFAULT_COLOR];
    const values = new Set<string>();
    activeProduct.variants.forEach((variant) => values.add(variant.color));
    activeProduct.photos.forEach((photo) => photo.color && values.add(photo.color));
    return values.size ? [...values] : [DEFAULT_COLOR];
  }, [activeProduct]);
  const uploadColor = colors.includes(photoColor) ? photoColor : colors[0];

  async function refreshProducts(selectId?: string) {
    const payload = await requestJson<{ products: ClientProduct[] }>("/api/products");
    setProducts(payload.products);
    if (selectId) setSelectedId(selectId);
  }

  async function createProduct(event: FormEvent) {
    event.preventDefault();
    await withBusy("create", async () => {
      const payload = await requestJson<{ product: ClientProduct }>("/api/products", {
        method: "POST",
        body: JSON.stringify(createForm),
      });
      setProducts((current) => [payload.product, ...current.filter((item) => item.id !== payload.product.id)]);
      setSelectedId(payload.product.id);
      setVariantForm((current) => ({ ...current, price: payload.product.basePrice }));
      setToast({ tone: "ok", message: "Черновик создан, размеры уже развернуты в варианты." });
    });
  }

  async function saveProduct() {
    if (!activeProduct) return;
    await withBusy("save", async () => {
      const payload = await requestJson<{ product: ClientProduct }>(`/api/products/${activeProduct.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: activeProduct.title,
          brand: activeProduct.brand,
          category: activeProduct.category,
          goodsType: activeProduct.goodsType,
          productType: activeProduct.productType,
          adType: activeProduct.adType,
          gender: activeProduct.gender,
          condition: activeProduct.condition,
          basePrice: activeProduct.basePrice,
          description: activeProduct.description,
          generatedDescription: activeProduct.generatedDescription,
          status: activeProduct.status,
          variants: activeProduct.variants,
        }),
      });
      replaceProduct(payload.product);
      setToast({ tone: "ok", message: "Карточка сохранена." });
    });
  }

  async function generateMoreVariants(event: FormEvent) {
    event.preventDefault();
    if (!activeProduct) return;
    await withBusy("variants", async () => {
      const payload = await requestJson<{ product: ClientProduct }>(
        `/api/products/${activeProduct.id}/variants/generate`,
        {
          method: "POST",
          body: JSON.stringify(variantForm),
        },
      );
      replaceProduct(payload.product);
      setToast({ tone: "ok", message: `Варианты для цвета "${variantForm.color}" готовы.` });
    });
  }

  async function generateDescription() {
    if (!activeProduct) return;
    await withBusy("description", async () => {
      const payload = await requestJson<{ product: ClientProduct; source: "template" | "ai" }>(
        `/api/products/${activeProduct.id}/description/generate`,
        { method: "POST" },
      );
      replaceProduct(payload.product);
      setToast({
        tone: "ok",
        message: payload.source === "ai" ? "AI-описание готово." : "Шаблонное описание готово.",
      });
    });
  }

  async function uploadPhotos(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeProduct || !fileInputRef.current?.files?.length) return;
    const form = new FormData(event.currentTarget);
    await withBusy("photos", async () => {
      const response = await fetch(`/api/products/${activeProduct.id}/photos`, {
        method: "POST",
        body: form,
      });
      if (!response.ok) throw new Error(await response.text());
      const payload = (await response.json()) as { product: ClientProduct };
      replaceProduct(payload.product);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setToast({ tone: "ok", message: "Фото загружены и попадут в feed." });
    });
  }

  async function submitPublication() {
    if (!activeProduct) return;
    await withBusy("submit", async () => {
      const payload = await requestJson<{ status: string; errors: string[]; warnings: string[] }>(
        `/api/publications/${activeProduct.id}/submit`,
        { method: "POST" },
      );
      await refreshProducts(activeProduct.id);
      setToast({
        tone: payload.errors.length ? "error" : payload.warnings.length ? "warn" : "ok",
        message: payload.errors[0] || payload.warnings[0] || "Фид обновлен, публикация отправлена в журнал.",
      });
    });
  }

  async function saveSettings(event: FormEvent) {
    event.preventDefault();
    await withBusy("settings", async () => {
      const payload = await requestJson<{ settings: ClientAvitoSettings }>("/api/settings/avito", {
        method: "PATCH",
        body: JSON.stringify({ ...settings, clientSecret: secretDraft }),
      });
      setSettings(payload.settings);
      setSecretDraft("");
      setToast({ tone: "ok", message: "Настройки Avito сохранены." });
    });
  }

  async function testAvito() {
    await withBusy("test-avito", async () => {
      const payload = await requestJson<{ ok: boolean; status: string }>("/api/settings/avito", {
        method: "POST",
      });
      setToast({
        tone: payload.ok ? "ok" : "warn",
        message: `Avito API: ${payload.status}`,
      });
    });
  }

  function replaceProduct(product: ClientProduct) {
    setProducts((current) => current.map((item) => (item.id === product.id ? product : item)));
  }

  function patchActiveProduct(patch: Partial<ClientProduct>) {
    if (!activeProduct) return;
    setProducts((current) =>
      current.map((product) => (product.id === activeProduct.id ? { ...product, ...patch } : product)),
    );
  }

  function patchVariant(id: string, patch: Partial<ClientVariant>) {
    if (!activeProduct) return;
    patchActiveProduct({
      variants: activeProduct.variants.map((variant) => (variant.id === id ? { ...variant, ...patch } : variant)),
    });
  }

  async function withBusy(name: string, fn: () => Promise<void>) {
    setBusy(name);
    setToast(null);
    try {
      await fn();
    } catch (error) {
      setToast({ tone: "error", message: error instanceof Error ? error.message : "Что-то пошло не так." });
    } finally {
      setBusy("");
    }
  }

  return (
    <main className="min-h-screen bg-canvas text-ink">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-[1480px] flex-col gap-4 px-4 py-4 md:flex-row md:items-center md:justify-between md:px-6">
          <div>
            <p className="text-xs uppercase tracking-wide text-moss">Avito dropshipping manager</p>
            <h1 className="mt-1 text-2xl font-semibold">Товары, варианты, фид и API в одном рабочем экране</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <a
              className="inline-flex h-10 items-center gap-2 rounded-md border border-line bg-white px-3 text-sm font-medium hover:bg-canvas"
              href="/api/avito/feed.xml"
              target="_blank"
              rel="noreferrer"
              title="Открыть XML-фид"
            >
              <Download className="h-4 w-4" />
              XML feed
            </a>
            <button
              className="inline-flex h-10 items-center gap-2 rounded-md border border-line bg-white px-3 text-sm font-medium hover:bg-canvas"
              type="button"
              onClick={() => refreshProducts(activeProduct?.id)}
              title="Обновить данные"
            >
              <RefreshCw className="h-4 w-4" />
              Обновить
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1480px] gap-4 px-4 py-4 md:grid-cols-[310px_minmax(0,1fr)_360px] md:px-6">
        <aside className="space-y-4">
          <section className="rounded-md border border-line bg-white p-4 shadow-panel">
            <div className="mb-3 flex items-center gap-2">
              <PackagePlus className="h-5 w-5 text-sea" />
              <h2 className="text-base font-semibold">Новый товар</h2>
            </div>
            <form className="space-y-3" onSubmit={createProduct}>
              <TextInput
                label="Название"
                value={createForm.title}
                onChange={(value) => setCreateForm((current) => ({ ...current, title: value }))}
              />
              <div className="grid grid-cols-2 gap-2">
                <TextInput
                  label="Бренд"
                  value={createForm.brand}
                  onChange={(value) => setCreateForm((current) => ({ ...current, brand: value }))}
                />
                <NumberInput
                  label="Цена"
                  value={createForm.basePrice}
                  onChange={(value) => setCreateForm((current) => ({ ...current, basePrice: value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <TextInput
                  label="Цвет"
                  value={createForm.color}
                  onChange={(value) => setCreateForm((current) => ({ ...current, color: value }))}
                />
                <NumberInput
                  label="Остаток"
                  value={createForm.stockQty}
                  onChange={(value) => setCreateForm((current) => ({ ...current, stockQty: value }))}
                />
              </div>
              <SizePicker
                selected={createForm.sizes}
                onChange={(sizes) => setCreateForm((current) => ({ ...current, sizes }))}
              />
              <ActionButton busy={busy === "create"} icon={<PackagePlus className="h-4 w-4" />} label="Создать" />
            </form>
          </section>

          <section className="rounded-md border border-line bg-white p-2 shadow-panel">
            <h2 className="px-2 py-2 text-sm font-semibold text-moss">Каталог</h2>
            <div className="space-y-2">
              {products.length ? (
                products.map((product) => (
                  <button
                    key={product.id}
                    className={clsx(
                      "w-full rounded-md border p-3 text-left transition hover:border-sea",
                      product.id === activeProduct?.id ? "border-sea bg-teal-50" : "border-line bg-white",
                    )}
                    type="button"
                    onClick={() => setSelectedId(product.id)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-sm font-semibold">{product.title}</span>
                      <StatusBadge status={product.status} />
                    </div>
                    <p className="mt-2 text-xs text-moss">
                      {product.variants.length} вариантов · {activeCount(product)} активных · {product.photos.length} фото
                    </p>
                  </button>
                ))
              ) : (
                <p className="px-2 py-6 text-sm text-moss">Создайте первый товар, и он появится здесь.</p>
              )}
            </div>
          </section>
        </aside>

        <section className="min-w-0 rounded-md border border-line bg-white shadow-panel">
          {activeProduct ? (
            <div className="divide-y divide-line">
              <div className="p-4">
                <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <p className="text-xs uppercase tracking-wide text-moss">Редактор карточки</p>
                    <h2 className="mt-1 break-words text-xl font-semibold">{activeProduct.title}</h2>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      className="inline-flex h-10 items-center gap-2 rounded-md bg-ink px-3 text-sm font-medium text-white hover:bg-black"
                      type="button"
                      onClick={saveProduct}
                      disabled={busy === "save"}
                      title="Сохранить карточку"
                    >
                      {busy === "save" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      Сохранить
                    </button>
                    <button
                      className="inline-flex h-10 items-center gap-2 rounded-md bg-sea px-3 text-sm font-medium text-white hover:bg-teal-800"
                      type="button"
                      onClick={submitPublication}
                      disabled={busy === "submit"}
                      title="Проверить и отправить"
                    >
                      {busy === "submit" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      Отправить
                    </button>
                  </div>
                </div>

                <div className="grid gap-3 lg:grid-cols-4">
                  <TextInput
                    label="Название"
                    value={activeProduct.title}
                    onChange={(value) => patchActiveProduct({ title: value })}
                  />
                  <TextInput
                    label="Бренд"
                    value={activeProduct.brand ?? ""}
                    onChange={(value) => patchActiveProduct({ brand: value })}
                  />
                  <NumberInput
                    label="Базовая цена"
                    value={activeProduct.basePrice}
                    onChange={(value) => patchActiveProduct({ basePrice: value })}
                  />
                  <SelectInput
                    label="Статус"
                    value={activeProduct.status}
                    options={["DRAFT", "READY", "ARCHIVED"]}
                    onChange={(value) => patchActiveProduct({ status: value })}
                  />
                </div>

                <div className="mt-3 grid gap-3 lg:grid-cols-5">
                  <TextInput
                    label="Категория"
                    value={activeProduct.category}
                    onChange={(value) => patchActiveProduct({ category: value })}
                  />
                  <TextInput
                    label="Тип товара"
                    value={activeProduct.goodsType}
                    onChange={(value) => patchActiveProduct({ goodsType: value })}
                  />
                  <TextInput
                    label="Подтип"
                    value={activeProduct.productType}
                    onChange={(value) => patchActiveProduct({ productType: value })}
                  />
                  <TextInput
                    label="Пол"
                    value={activeProduct.gender}
                    onChange={(value) => patchActiveProduct({ gender: value })}
                  />
                  <TextInput
                    label="Состояние"
                    value={activeProduct.condition}
                    onChange={(value) => patchActiveProduct({ condition: value })}
                  />
                </div>
              </div>

              <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_320px]">
                <div className="min-w-0 p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h3 className="text-base font-semibold">Варианты по цветам и размерам</h3>
                    <span className="text-xs text-moss">{activeCount(activeProduct)} попадут в XML</span>
                  </div>
                  <div className="overflow-x-auto rounded-md border border-line scrollbar-thin">
                    <table className="min-w-[720px] w-full divide-y divide-line text-sm">
                      <thead className="bg-canvas text-xs uppercase tracking-wide text-moss">
                        <tr>
                          <th className="px-3 py-2 text-left">SKU</th>
                          <th className="px-3 py-2 text-left">Цвет</th>
                          <th className="px-3 py-2 text-left">Размер</th>
                          <th className="px-3 py-2 text-left">Цена</th>
                          <th className="px-3 py-2 text-left">Остаток</th>
                          <th className="px-3 py-2 text-left">Статус</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line bg-white">
                        {activeProduct.variants.map((variant) => (
                          <tr key={variant.id}>
                            <td className="whitespace-nowrap px-3 py-2 font-mono text-xs">{variant.sku}</td>
                            <td className="px-3 py-2">
                              <InlineInput
                                value={variant.color}
                                onChange={(value) => patchVariant(variant.id, { color: value })}
                              />
                            </td>
                            <td className="px-3 py-2">
                              <InlineInput
                                value={variant.size}
                                onChange={(value) => patchVariant(variant.id, { size: value })}
                              />
                            </td>
                            <td className="px-3 py-2">
                              <InlineNumber
                                value={variant.price}
                                onChange={(value) => patchVariant(variant.id, { price: value })}
                              />
                            </td>
                            <td className="px-3 py-2">
                              <InlineNumber
                                value={variant.stockQty}
                                onChange={(value) =>
                                  patchVariant(variant.id, {
                                    stockQty: value,
                                    publicationStatus: value === 0 ? "SUSPENDED" : variant.publicationStatus,
                                  })
                                }
                              />
                            </td>
                            <td className="px-3 py-2">
                              <select
                                className="h-9 w-full rounded-md border-line text-sm"
                                value={variant.publicationStatus}
                                onChange={(event) =>
                                  patchVariant(variant.id, { publicationStatus: event.target.value })
                                }
                              >
                                <option value="DRAFT">DRAFT</option>
                                <option value="SUBMITTED">SUBMITTED</option>
                                <option value="SUSPENDED">SUSPENDED</option>
                              </select>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <form className="border-t border-line p-4 lg:border-l lg:border-t-0" onSubmit={generateMoreVariants}>
                  <h3 className="mb-3 text-base font-semibold">Добавить цвет</h3>
                  <div className="space-y-3">
                    <TextInput
                      label="Цвет"
                      value={variantForm.color}
                      onChange={(value) => setVariantForm((current) => ({ ...current, color: value }))}
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <NumberInput
                        label="Цена"
                        value={variantForm.price}
                        onChange={(value) => setVariantForm((current) => ({ ...current, price: value }))}
                      />
                      <NumberInput
                        label="Остаток"
                        value={variantForm.stockQty}
                        onChange={(value) => setVariantForm((current) => ({ ...current, stockQty: value }))}
                      />
                    </div>
                    <SizePicker
                      selected={variantForm.sizes}
                      onChange={(sizes) => setVariantForm((current) => ({ ...current, sizes }))}
                    />
                    <ActionButton
                      busy={busy === "variants"}
                      icon={<PackagePlus className="h-4 w-4" />}
                      label="Сгенерировать варианты"
                    />
                  </div>
                </form>
              </div>

              <div className="grid gap-0 lg:grid-cols-[360px_minmax(0,1fr)]">
                <div className="border-b border-line p-4 lg:border-b-0 lg:border-r">
                  <h3 className="mb-3 flex items-center gap-2 text-base font-semibold">
                    <ImagePlus className="h-5 w-5 text-sea" />
                    Фото по цвету
                  </h3>
                  <form className="space-y-3" onSubmit={uploadPhotos}>
                    <SelectInput
                      label="Цвет"
                      name="color"
                      value={uploadColor}
                      options={colors}
                      onChange={setPhotoColor}
                    />
                    <label className="block rounded-md border border-dashed border-line bg-canvas p-4 text-center">
                      <UploadCloud className="mx-auto h-8 w-8 text-sea" />
                      <span className="mt-2 block text-sm font-medium">Выберите фото</span>
                      <input
                        ref={fileInputRef}
                        className="mt-3 block w-full text-sm"
                        name="files"
                        type="file"
                        accept="image/*"
                        multiple
                      />
                    </label>
                    <ActionButton busy={busy === "photos"} icon={<UploadCloud className="h-4 w-4" />} label="Загрузить" />
                  </form>
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    {activeProduct.photos.map((photo) => (
                      <div key={photo.id} className="overflow-hidden rounded-md border border-line bg-canvas">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img className="aspect-square w-full object-cover" src={photo.publicUrl} alt={photo.originalName} />
                        <p className="truncate px-2 py-1 text-xs text-moss">{photo.color || "Все"}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-base font-semibold">Описание Avito</h3>
                    <button
                      className="inline-flex h-9 items-center gap-2 rounded-md bg-honey px-3 text-sm font-medium text-white hover:bg-yellow-700"
                      type="button"
                      onClick={generateDescription}
                      disabled={busy === "description"}
                      title="Сгенерировать описание"
                    >
                      {busy === "description" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4" />
                      )}
                      Генерировать
                    </button>
                  </div>
                  <textarea
                    className="min-h-[180px] w-full rounded-md border-line text-sm"
                    value={activeProduct.description}
                    onChange={(event) => patchActiveProduct({ description: event.target.value })}
                    placeholder="Дополнительные факты: материал, посадка, доставка, замеры."
                  />
                  <div className="mt-3 rounded-md border border-line bg-canvas p-3">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-moss">Превью</p>
                    <pre className="max-h-[260px] whitespace-pre-wrap break-words text-sm leading-6">
                      {activeProduct.generatedDescription || activeProduct.description || "Описание пока пустое."}
                    </pre>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center text-moss">Создайте товар, чтобы открыть редактор.</div>
          )}
        </section>

        <aside className="space-y-4">
          <section className="rounded-md border border-line bg-white p-4 shadow-panel">
            <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
              <Settings className="h-5 w-5 text-sea" />
              Avito API
            </h2>
            <form className="space-y-3" onSubmit={saveSettings}>
              <TextInput
                label="Client ID"
                value={settings.clientId}
                onChange={(value) => setSettings((current) => ({ ...current, clientId: value }))}
              />
              <TextInput
                label={settings.hasClientSecret ? "Client secret (заменить)" : "Client secret"}
                value={secretDraft}
                type="password"
                onChange={setSecretDraft}
              />
              <TextInput
                label="Публичный URL фида"
                value={settings.publicFeedUrl}
                onChange={(value) => setSettings((current) => ({ ...current, publicFeedUrl: value }))}
              />
              <TextInput
                label="Redirect URL"
                value={settings.redirectUrl}
                onChange={(value) => setSettings((current) => ({ ...current, redirectUrl: value }))}
              />
              <div className="grid grid-cols-2 gap-2">
                <TextInput
                  label="Город"
                  value={settings.sellerLocation}
                  onChange={(value) => setSettings((current) => ({ ...current, sellerLocation: value }))}
                />
                <TextInput
                  label="Адрес"
                  value={settings.address}
                  onChange={(value) => setSettings((current) => ({ ...current, address: value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <TextInput
                  label="Контакт"
                  value={settings.contactName}
                  onChange={(value) => setSettings((current) => ({ ...current, contactName: value }))}
                />
                <TextInput
                  label="Телефон"
                  value={settings.phone}
                  onChange={(value) => setSettings((current) => ({ ...current, phone: value }))}
                />
              </div>
              <TextInput
                label="Email"
                value={settings.email}
                onChange={(value) => setSettings((current) => ({ ...current, email: value }))}
              />
              <div className="grid grid-cols-2 gap-2">
                <ActionButton busy={busy === "settings"} icon={<Save className="h-4 w-4" />} label="Сохранить" />
                <button
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-line bg-white px-3 text-sm font-medium hover:bg-canvas"
                  type="button"
                  onClick={testAvito}
                  disabled={busy === "test-avito"}
                  title="Проверить API"
                >
                  {busy === "test-avito" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  Тест
                </button>
              </div>
            </form>
          </section>

          <section className="rounded-md border border-line bg-white p-4 shadow-panel">
            <h2 className="mb-3 text-base font-semibold">Публикация</h2>
            <div className="space-y-2 text-sm">
              <InfoRow label="Домен" value="https://amsterdam2.sebog1.ru" />
              <InfoRow label="Порт VPS" value="4317" />
              <InfoRow label="Callback" value="/api/avito/oauth/callback" />
            </div>
            <a
              className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-ink px-3 text-sm font-medium text-white hover:bg-black"
              href="/api/avito/feed.xml"
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink className="h-4 w-4" />
              Открыть XML
            </a>
          </section>

          {activeProduct?.publicationRuns.length ? (
            <section className="rounded-md border border-line bg-white p-4 shadow-panel">
              <h2 className="mb-3 text-base font-semibold">Журнал</h2>
              <div className="space-y-3">
                {activeProduct.publicationRuns.map((run) => (
                  <div key={run.id} className="rounded-md border border-line bg-canvas p-3">
                    <div className="flex items-center justify-between gap-2">
                      <StatusBadge status={run.status} />
                      <span className="text-xs text-moss">{new Date(run.submittedAt).toLocaleString("ru-RU")}</span>
                    </div>
                    <p className="mt-2 text-xs text-moss">Feed version: {run.feedVersion}</p>
                    {[...run.errors, ...run.warnings].map((message) => (
                      <p key={message} className="mt-2 text-xs text-signal">
                        {message}
                      </p>
                    ))}
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </aside>
      </div>

      {toast ? (
        <div
          className={clsx(
            "fixed bottom-4 left-1/2 z-10 max-w-[min(92vw,620px)] -translate-x-1/2 rounded-md px-4 py-3 text-sm shadow-lg",
            toast.tone === "ok" && "bg-sea text-white",
            toast.tone === "warn" && "bg-honey text-white",
            toast.tone === "error" && "bg-signal text-white",
          )}
        >
          {toast.message}
        </div>
      ) : null}
    </main>
  );
}

function TextInput({
  label,
  value,
  onChange,
  type = "text",
  name,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  name?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-moss">{label}</span>
      <input
        className="h-10 w-full rounded-md border-line text-sm"
        name={name}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function NumberInput({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-moss">{label}</span>
      <input
        className="h-10 w-full rounded-md border-line text-sm"
        min={0}
        type="number"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

function SelectInput({
  label,
  value,
  options,
  onChange,
  name,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  name?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-moss">{label}</span>
      <select
        className="h-10 w-full rounded-md border-line text-sm"
        name={name}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function InlineInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <input
      className="h-9 w-full min-w-[92px] rounded-md border-line text-sm"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

function InlineNumber({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return (
    <input
      className="h-9 w-full min-w-[84px] rounded-md border-line text-sm"
      min={0}
      type="number"
      value={value}
      onChange={(event) => onChange(Number(event.target.value))}
    />
  );
}

function SizePicker({ selected, onChange }: { selected: string[]; onChange: (sizes: string[]) => void }) {
  return (
    <div>
      <p className="mb-2 text-xs font-medium text-moss">Размеры</p>
      <div className="grid grid-cols-4 gap-2">
        {CLOTHING_SIZES.map((size) => {
          const checked = selected.includes(size);
          return (
            <button
              key={size}
              className={clsx(
                "h-9 rounded-md border text-sm font-medium transition",
                checked ? "border-sea bg-teal-50 text-sea" : "border-line bg-white hover:bg-canvas",
              )}
              type="button"
              onClick={() =>
                onChange(checked ? selected.filter((item) => item !== size) : [...selected, size])
              }
            >
              {size}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ActionButton({ busy, icon, label }: { busy: boolean; icon: React.ReactNode; label: string }) {
  return (
    <button
      className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-sea px-3 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
      type="submit"
      disabled={busy}
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      {label}
    </button>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={clsx(
        "inline-flex shrink-0 rounded px-2 py-1 text-[11px] font-semibold uppercase",
        ["READY", "SUBMITTED"].includes(status) && "bg-teal-100 text-sea",
        ["WARNING", "DRAFT"].includes(status) && "bg-amber-100 text-honey",
        ["ERROR", "SUSPENDED"].includes(status) && "bg-red-100 text-signal",
        status === "ARCHIVED" && "bg-zinc-100 text-zinc-600",
      )}
    >
      {status}
    </span>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-line py-2 last:border-b-0">
      <span className="text-moss">{label}</span>
      <span className="break-all text-right font-medium">{value}</span>
    </div>
  );
}

function activeCount(product: ClientProduct) {
  return product.variants.filter((variant) => variant.stockQty > 0 && variant.publicationStatus !== "SUSPENDED").length;
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(payload.error || payload.message || "Request failed");
  }
  return payload as T;
}

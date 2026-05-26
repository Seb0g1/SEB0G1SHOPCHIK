"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ImagePlus, Plus, Search, Star, Trash2, UploadCloud } from "lucide-react";
import type { ClientSupplier } from "@/lib/client-types";
import type { AvitoCatalogField, AvitoCategoryNode } from "@/lib/avito/catalog";
import { displayVariantSize, findFieldByRole, getFieldRole, isProductCoreField, isVariantField } from "@/lib/avito/field-utils";
import { DEFAULT_PRODUCT_DESCRIPTION_HTML } from "@/lib/defaults";
import { makeSku } from "@/lib/variants";
import { Button, NumberField, PageHeader, SelectField, TextField, requestJson } from "@/components/ui-kit";

type CatalogResponse<T> = { data: T; source: "api" | "cache" | "fallback"; warning?: string };

type ColorGroupDraft = {
  id: string;
  color: string;
  avitoColorValue: string;
  price: number;
  stockQty: number;
  sizes: string[];
  variantOverrides: Record<string, { price: number; stockQty: number; enabled: boolean }>;
  description: string;
  avitoFields: Record<string, string>;
  supplierId: string;
  photos: File[];
};

type PlannedVariant = {
  groupId: string;
  color: string;
  size: string;
  price: number;
  stockQty: number;
  enabled: boolean;
  sku: string;
  photoCount: number;
};

const oneSizeValue = "ONE_SIZE";
const sizePresets = [
  { label: "XS-3XL", sizes: ["XS", "S", "M", "L", "XL", "XXL", "2XL", "3XL"] },
  { label: "44-56", sizes: ["44", "46", "48", "50", "52", "54", "56"] },
  { label: "Без размера", sizes: [oneSizeValue] },
];

export function ProductWizard() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");
  const [categoryQuery, setCategoryQuery] = useState("");
  const [catalogSource, setCatalogSource] = useState<"api" | "cache" | "fallback">("fallback");
  const [catalogWarning, setCatalogWarning] = useState("");
  const [suppliers, setSuppliers] = useState<ClientSupplier[]>([]);
  const [tree, setTree] = useState<AvitoCategoryNode[]>([]);
  const [fields, setFields] = useState<AvitoCatalogField[]>([]);
  const [form, setForm] = useState({
    title: "",
    brand: "",
    basePrice: 0,
    avitoCategorySlug: "",
    avitoCategoryName: "",
    avitoFields: {} as Record<string, string>,
    supplierId: "",
    description: DEFAULT_PRODUCT_DESCRIPTION_HTML,
  });
  const [groups, setGroups] = useState<ColorGroupDraft[]>([makeGroup("Белый"), makeGroup("Черный")]);

  const flatCategories = useMemo(() => flattenCategories(tree), [tree]);
  const visibleCategories = useMemo(() => {
    const query = categoryQuery.trim().toLowerCase();
    const items = flatCategories.filter((category) => category.children.length === 0 || query);
    if (!query) return items.slice(0, 70);
    return items.filter((category) => category.path.toLowerCase().includes(query)).slice(0, 70);
  }, [flatCategories, categoryQuery]);

  const colorField = findFieldByRole(fields, "color");
  const sizeField = findFieldByRole(fields, "size");
  const brandField = findFieldByRole(fields, "brand");
  const categoryFields = fields.filter((field) => !isVariantField(field) && !isProductCoreField(field));
  const plannedVariants = useMemo(
    () => buildPlannedVariants(groups, sizeField, form.basePrice, form.title),
    [groups, sizeField, form.basePrice, form.title],
  );
  const activeVariants = plannedVariants.filter((variant) => variant.enabled && variant.stockQty > 0);
  const totalPhotos = groups.reduce((sum, group) => sum + group.photos.length, 0);
  const validationErrors = useMemo(
    () => validateWizard({ form, groups, fields, sizeField, plannedVariants }),
    [form, groups, fields, sizeField, plannedVariants],
  );
  const feedUrl = "/api/avito/feed.xml";

  useEffect(() => {
    requestJson<{ suppliers: ClientSupplier[] }>("/api/suppliers")
      .then((payload) => setSuppliers(payload.suppliers.filter((supplier) => supplier.active)))
      .catch(() => setSuppliers([]));

    requestJson<CatalogResponse<AvitoCategoryNode[]>>("/api/avito/catalog/tree")
      .then((payload) => {
        setTree(payload.data);
        setCatalogSource(payload.source);
        setCatalogWarning(payload.warning ?? "");
      })
      .catch((error) => setToast(error instanceof Error ? error.message : "Не удалось загрузить категории Avito"));
  }, []);

  useEffect(() => {
    if (!form.avitoCategorySlug) return;
    requestJson<CatalogResponse<AvitoCatalogField[]>>(`/api/avito/catalog/nodes/${encodeURIComponent(form.avitoCategorySlug)}/fields`)
      .then((payload) => {
        setFields(payload.data);
        setCatalogSource(payload.source);
        setCatalogWarning(payload.warning ?? "");
        setForm((current) => normalizeFormForFields(current, payload.data));
      })
      .catch((error) => setToast(error instanceof Error ? error.message : "Не удалось загрузить поля категории Avito"));
  }, [form.avitoCategorySlug]);

  async function finish() {
    if (validationErrors.length) {
      setToast(validationErrors[0]);
      return;
    }

    setBusy(true);
    setToast("");
    try {
      const avitoFields = syncCoreFields(form.avitoFields);
      const payload = await requestJson<{ product: { id: string } }>("/api/products/bulk", {
        method: "POST",
        body: JSON.stringify({
          title: form.title,
          brand: form.brand,
          supplierId: form.supplierId || null,
          basePrice: form.basePrice,
          avitoCategorySlug: form.avitoCategorySlug,
          avitoCategoryName: form.avitoCategoryName,
          avitoFields,
          colorGroups: groups.map((group) => {
            const rows = variantRowsForGroup(group, sizeField, form.basePrice);
            return {
              color: group.color,
              supplierId: group.supplierId || null,
              avitoColorValue: group.avitoColorValue || group.color,
              basePrice: group.price || form.basePrice,
              defaultStockQty: group.stockQty,
              description: group.description,
              avitoFields: {
                ...group.avitoFields,
                ...(colorField ? { [colorField.key]: group.avitoColorValue || group.color } : {}),
              },
              sizes: sizeField ? group.sizes : [oneSizeValue],
              variants: rows.map((row) => ({
                size: row.size,
                price: row.price,
                stockQty: row.enabled ? row.stockQty : 0,
                active: row.enabled,
              })),
            };
          }),
        }),
      });

      await requestJson(`/api/products/${payload.product.id}`, {
        method: "PATCH",
        body: JSON.stringify({ description: form.description, generatedDescription: form.description, avitoFields }),
      });

      for (const group of groups) {
        if (!group.photos.length) continue;
        const data = new FormData();
        data.append("color", group.avitoColorValue || group.color);
        group.photos.forEach((file) => data.append("files", file));
        await fetch(`/api/products/${payload.product.id}/photos`, { method: "POST", body: data });
      }

      router.push(`/products/${payload.product.id}`);
      router.refresh();
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Не удалось создать товар");
    } finally {
      setBusy(false);
    }
  }

  function syncCoreFields(values: Record<string, string>) {
    return {
      ...values,
      ...(brandField ? { [brandField.key]: form.brand } : {}),
    };
  }

  function selectCategory(category: AvitoCategoryNode) {
    setForm((item) => ({
      ...item,
      avitoCategorySlug: category.slug,
      avitoCategoryName: category.path,
      avitoFields: {},
    }));
  }

  function applyPreset(sizes: string[]) {
    const normalized = normalizePresetSizes(sizes, sizeField);
    setGroups((items) => items.map((group) => ({ ...group, sizes: normalized })));
  }

  return (
    <>
      <PageHeader
        eyebrow="Новый товар"
        title="Массовая загрузка товара в Avito"
        actions={
          <Button busy={busy} disabled={Boolean(validationErrors.length)} onClick={finish}>
            <Check className="h-4 w-4" />
            Создать товар
          </Button>
        }
      />

      <div className="grid gap-4 p-4 xl:grid-cols-[minmax(0,1fr)_360px] xl:p-6">
        <main className="space-y-4">
          <section className="rounded-md border border-line bg-white p-5 shadow-panel">
            <SectionHeading title="1. Основа товара" text="Один внутренний товар будет развернут в отдельные объявления по цветам и размерам." />
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <TextField label="Название как на Avito" value={form.title} onChange={(title) => setForm((item) => ({ ...item, title }))} />
              <TextField label="Бренд" value={form.brand} onChange={(brand) => setForm((item) => ({ ...item, brand }))} />
              <NumberField label="Базовая цена" value={form.basePrice} onChange={(basePrice) => setForm((item) => ({ ...item, basePrice }))} />
              <SupplierSelect
                label="Поставщик по умолчанию"
                value={form.supplierId}
                suppliers={suppliers}
                onChange={(supplierId) => setForm((item) => ({ ...item, supplierId }))}
              />
            </div>
          </section>

          <section className="rounded-md border border-line bg-white p-5 shadow-panel">
            <SectionHeading title="2. Категория Avito" text="Категория определяет обязательные поля, доступные цвета и размеры." />
            <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
              <div>
                <label className="relative block">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-moss" />
                  <input
                    className="h-10 w-full rounded-md border-line pl-9 text-sm"
                    placeholder="Поиск категории Avito"
                    value={categoryQuery}
                    onChange={(event) => setCategoryQuery(event.target.value)}
                  />
                </label>
                <div className="mt-3 max-h-[290px] overflow-y-auto rounded-md border border-line">
                  {visibleCategories.map((category) => (
                    <button
                      key={category.slug}
                      className={`block w-full border-b border-line px-3 py-3 text-left text-sm last:border-b-0 ${
                        category.slug === form.avitoCategorySlug ? "bg-teal-50 text-sea" : "bg-white hover:bg-canvas"
                      }`}
                      type="button"
                      onClick={() => selectCategory(category)}
                    >
                      <span className="font-semibold">{category.name}</span>
                      <span className="mt-1 block text-xs text-moss">{category.path}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="rounded-md border border-line bg-canvas p-4">
                <p className="text-xs font-semibold uppercase text-moss">Выбрано</p>
                <p className="mt-2 text-sm font-semibold">{form.avitoCategoryName || "Категория еще не выбрана"}</p>
                <p className="mt-4 text-xs leading-5 text-moss">
                  Источник справочника: <span className="font-semibold uppercase">{catalogSource}</span>
                </p>
                {catalogWarning ? <p className="mt-2 text-xs leading-5 text-amber-700">{catalogWarning}</p> : null}
              </div>
            </div>
          </section>

          <section className="rounded-md border border-line bg-white p-5 shadow-panel">
            <SectionHeading title="3. Поля Avito" text="Заполните обязательные параметры выбранной категории. Цвет и размер берутся из матрицы ниже." />
            <div className="mt-4">
              <DynamicFields fields={categoryFields} values={form.avitoFields} onChange={(avitoFields) => setForm((item) => ({ ...item, avitoFields }))} />
            </div>
          </section>

          <section className="rounded-md border border-line bg-white p-5 shadow-panel">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <SectionHeading title="4. Цвета, размеры и фото" text="Каждая активная ячейка матрицы станет отдельным объявлением Avito." />
              <Button tone="secondary" onClick={() => setGroups((items) => [...items, makeGroup("Новый цвет", form.basePrice)])}>
                <Plus className="h-4 w-4" />
                Добавить цвет
              </Button>
            </div>

            <SizePresetBar field={sizeField} onApply={applyPreset} />

            <div className="mt-4 space-y-4">
              {groups.map((group, index) => (
                <ColorGroupCard
                  key={group.id}
                  group={group}
                  index={index}
                  groupsCount={groups.length}
                  colorField={colorField}
                  sizeField={sizeField}
                  basePrice={form.basePrice}
                  suppliers={suppliers}
                  onRemove={() => setGroups((items) => items.filter((item) => item.id !== group.id))}
                  onChange={(patch) => setGroups((items) => items.map((item) => (item.id === group.id ? { ...item, ...patch } : item)))}
                />
              ))}
            </div>
          </section>

          <section className="rounded-md border border-line bg-white p-5 shadow-panel">
            <SectionHeading title="5. Описание и предпросмотр" text="Описание будет вставлено в каждое объявление с добавлением цвета, размера, артикула и остатка." />
            <label className="mt-4 block">
              <span className="mb-1 block text-xs font-semibold text-moss">Общее описание</span>
              <textarea
                className="min-h-[150px] w-full rounded-md border-line text-sm"
                value={form.description}
                onChange={(event) => setForm((item) => ({ ...item, description: event.target.value }))}
              />
            </label>

            <div className="mt-4 overflow-x-auto rounded-md border border-line">
              <table className="min-w-[780px] w-full divide-y divide-line text-sm">
                <thead className="bg-canvas text-xs uppercase text-moss">
                  <tr>
                    <th className="px-3 py-2 text-left">SKU / Id</th>
                    <th className="px-3 py-2 text-left">Цвет</th>
                    <th className="px-3 py-2 text-left">Размер</th>
                    <th className="px-3 py-2 text-left">Цена</th>
                    <th className="px-3 py-2 text-left">Остаток</th>
                    <th className="px-3 py-2 text-left">Фото</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {activeVariants.slice(0, 40).map((variant) => (
                    <tr key={`${variant.groupId}-${variant.size}`}>
                      <td className="px-3 py-2 font-mono text-xs">{variant.sku}</td>
                      <td className="px-3 py-2">{variant.color}</td>
                      <td className="px-3 py-2">{displayVariantSize(variant.size)}</td>
                      <td className="px-3 py-2">{variant.price}</td>
                      <td className="px-3 py-2">{variant.stockQty}</td>
                      <td className="px-3 py-2">{variant.photoCount}</td>
                    </tr>
                  ))}
                  {!activeVariants.length ? (
                    <tr>
                      <td className="px-3 py-8 text-center text-moss" colSpan={6}>
                        Включите хотя бы одну ячейку с остатком больше 0.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            {activeVariants.length > 40 ? <p className="mt-2 text-xs text-moss">Показаны первые 40 объявлений из {activeVariants.length}.</p> : null}
          </section>
        </main>

        <aside className="space-y-4 xl:sticky xl:top-4 xl:self-start">
          <div className="rounded-md border border-line bg-white p-5 shadow-panel">
            <p className="text-xs font-semibold uppercase text-moss">Готовность</p>
            <p className="mt-2 text-3xl font-semibold">{activeVariants.length}</p>
            <p className="mt-1 text-sm text-moss">активных объявлений будет отправлено в Avito</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Summary label="Цветов" value={groups.length} />
              <Summary label="Всего ячеек" value={plannedVariants.length} />
              <Summary label="Фото" value={totalPhotos} />
              <Summary label="Ошибок" value={validationErrors.length} />
            </div>
            <p className="mt-4 break-all rounded-md bg-canvas p-3 text-xs font-semibold">{feedUrl}</p>
            <p className="mt-2 text-xs leading-5 text-moss">Если Avito не даст доступ к Autoload profile, этот feed URL нужно вставить вручную в кабинете Авито.</p>
          </div>

          <div className="rounded-md border border-line bg-white p-5 shadow-panel">
            <p className="font-semibold">Проверка</p>
            {validationErrors.length ? (
              <div className="mt-3 space-y-2">
                {validationErrors.slice(0, 6).map((error) => (
                  <p key={error} className="rounded-md bg-red-50 p-2 text-xs font-semibold leading-5 text-red-700">
                    {error}
                  </p>
                ))}
              </div>
            ) : (
              <p className="mt-3 rounded-md bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">Можно создавать товар и отправлять в Avito.</p>
            )}
          </div>

          <Button className="w-full" busy={busy} disabled={Boolean(validationErrors.length)} onClick={finish}>
            <UploadCloud className="h-4 w-4" />
            Создать {activeVariants.length} объявлений
          </Button>

          {toast ? <p className="rounded-md bg-ink p-3 text-sm font-semibold text-white">{toast}</p> : null}
        </aside>
      </div>
    </>
  );
}

function ColorGroupCard({
  group,
  index,
  groupsCount,
  colorField,
  sizeField,
  basePrice,
  suppliers,
  onChange,
  onRemove,
}: {
  group: ColorGroupDraft;
  index: number;
  groupsCount: number;
  colorField?: AvitoCatalogField;
  sizeField?: AvitoCatalogField;
  basePrice: number;
  suppliers: ClientSupplier[];
  onChange: (patch: Partial<ColorGroupDraft>) => void;
  onRemove: () => void;
}) {
  const activeRows = variantRowsForGroup(group, sizeField, basePrice).filter((row) => row.enabled && row.stockQty > 0);
  function movePhotoFirst(index: number) {
    const photo = group.photos[index];
    if (!photo) return;
    onChange({ photos: [photo, ...group.photos.filter((_, itemIndex) => itemIndex !== index)] });
  }

  return (
    <div className="rounded-md border border-line bg-canvas p-4">
      <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="font-semibold">Цвет #{index + 1}: {group.avitoColorValue || group.color || "без названия"}</p>
          <p className="mt-1 text-xs text-moss">{activeRows.length} активных объявлений · {group.photos.length} фото</p>
        </div>
        <Button tone="danger" disabled={groupsCount === 1} onClick={onRemove}>
          <Trash2 className="h-4 w-4" />
          Удалить
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {colorField ? (
          <AvitoFieldControl
            field={colorField}
            value={group.avitoColorValue || group.color}
            onChange={(value) => onChange({ color: value, avitoColorValue: value })}
          />
        ) : (
          <TextField label="Цвет" value={group.color} onChange={(color) => onChange({ color, avitoColorValue: color })} />
        )}
        <NumberField label="Цена цвета" value={group.price || basePrice} onChange={(price) => onChange({ price })} />
        <NumberField label="Остаток на размер" value={group.stockQty} onChange={(stockQty) => onChange({ stockQty })} />
        <SupplierSelect label="Поставщик цвета" value={group.supplierId} suppliers={suppliers} onChange={(supplierId) => onChange({ supplierId })} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        <label className="flex min-h-[132px] cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-line bg-white p-4 text-center">
          <ImagePlus className="h-9 w-9 text-sea" />
          <span className="mt-2 text-sm font-semibold">Фото этого цвета</span>
          <span className="mt-1 text-xs text-moss">{group.photos.length ? `${group.photos.length} файлов выбрано` : "Нажмите для выбора"}</span>
          <input
            className="sr-only"
            type="file"
            accept="image/*"
            multiple
            onChange={(event) => onChange({ photos: Array.from(event.target.files ?? []) })}
          />
        </label>

        <div className="space-y-4">
          {group.photos.length ? (
            <div className="rounded-md border border-line bg-white p-3">
              <p className="text-xs font-semibold text-moss">Первое фото станет главным на Avito</p>
              <div className="mt-2 space-y-2">
                {group.photos.map((file, index) => (
                  <div key={`${file.name}-${index}`} className="flex items-center justify-between gap-2 rounded-md bg-canvas px-2 py-2 text-xs">
                    <span className="min-w-0 truncate font-semibold">{file.name}</span>
                    <Button tone={index === 0 ? "secondary" : "primary"} className="h-8 shrink-0 px-2 text-xs" onClick={() => movePhotoFirst(index)}>
                      <Star className="h-3.5 w-3.5" />
                      {index === 0 ? "Главное" : "Первым"}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          {sizeField ? (
            <LinkedSizePicker field={sizeField} selected={group.sizes} onChange={(sizes) => onChange({ sizes })} />
          ) : (
            <p className="rounded-md border border-line bg-white p-3 text-sm text-moss">Avito не вернул поле размера для этой категории. Будет создан вариант ONE_SIZE.</p>
          )}
          <VariantMatrix
            group={group}
            sizeField={sizeField}
            basePrice={basePrice}
            onChange={(variantOverrides) => onChange({ variantOverrides })}
          />
        </div>
      </div>

      <label className="mt-4 block">
        <span className="mb-1 block text-xs font-semibold text-moss">Описание для этого цвета</span>
        <textarea
          className="min-h-[84px] w-full rounded-md border-line text-sm"
          value={group.description}
          onChange={(event) => onChange({ description: event.target.value })}
        />
      </label>
    </div>
  );
}

function VariantMatrix({
  group,
  sizeField,
  basePrice,
  onChange,
}: {
  group: ColorGroupDraft;
  sizeField?: AvitoCatalogField;
  basePrice: number;
  onChange: (overrides: ColorGroupDraft["variantOverrides"]) => void;
}) {
  const rows = variantRowsForGroup(group, sizeField, basePrice);
  if (!rows.length) {
    return <p className="rounded-md border border-line bg-white p-3 text-sm text-moss">Выберите размеры, чтобы увидеть матрицу цены и остатков.</p>;
  }

  function patch(size: string, patch: Partial<{ price: number; stockQty: number; enabled: boolean }>) {
    const current = group.variantOverrides[size] ?? {
      price: group.price || basePrice,
      stockQty: group.stockQty,
      enabled: true,
    };
    onChange({
      ...group.variantOverrides,
      [size]: {
        price: patch.price ?? current.price,
        stockQty: patch.stockQty ?? current.stockQty,
        enabled: patch.enabled ?? current.enabled,
      },
    });
  }

  return (
    <div className="overflow-x-auto rounded-md border border-line bg-white">
      <table className="min-w-[620px] w-full divide-y divide-line text-sm">
        <thead className="bg-canvas text-xs uppercase text-moss">
          <tr>
            <th className="px-3 py-2 text-left">Вкл</th>
            <th className="px-3 py-2 text-left">Размер</th>
            <th className="px-3 py-2 text-left">Цена</th>
            <th className="px-3 py-2 text-left">Остаток</th>
            <th className="px-3 py-2 text-left">Статус</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((row) => (
            <tr key={row.size} className={row.enabled ? "bg-white" : "bg-zinc-50 text-zinc-500"}>
              <td className="px-3 py-2">
                <input
                  className="h-4 w-4 rounded border-line text-sea"
                  type="checkbox"
                  checked={row.enabled}
                  onChange={(event) => patch(row.size, { enabled: event.target.checked })}
                />
              </td>
              <td className="px-3 py-2 font-semibold">{displayVariantSize(row.size)}</td>
              <td className="px-3 py-2">
                <input
                  className="h-9 w-28 rounded-md border-line text-sm"
                  min={0}
                  type="number"
                  value={row.price}
                  onChange={(event) => patch(row.size, { price: Number(event.target.value) })}
                />
              </td>
              <td className="px-3 py-2">
                <input
                  className="h-9 w-24 rounded-md border-line text-sm"
                  min={0}
                  type="number"
                  value={row.stockQty}
                  onChange={(event) => patch(row.size, { stockQty: Number(event.target.value) })}
                />
              </td>
              <td className="px-3 py-2 text-xs font-semibold text-moss">{row.enabled && row.stockQty > 0 ? "пойдет в Avito" : "не выгружать"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SizePresetBar({ field, onApply }: { field?: AvitoCatalogField; onApply: (sizes: string[]) => void }) {
  const linkedValues = useFieldValues(field);
  const allValues = linkedValues.length ? linkedValues : [];

  return (
    <div className="mt-4 flex flex-wrap gap-2 rounded-md border border-line bg-canvas p-3">
      {sizePresets.map((preset) => (
        <Button key={preset.label} tone="secondary" onClick={() => onApply(preset.sizes)}>
          {preset.label}
        </Button>
      ))}
      {allValues.length ? (
        <Button tone="secondary" onClick={() => onApply(allValues)}>
          Все размеры Avito
        </Button>
      ) : null}
    </div>
  );
}

export function DynamicFields({
  fields,
  values,
  onChange,
}: {
  fields: AvitoCatalogField[];
  values: Record<string, string>;
  onChange: (values: Record<string, string>) => void;
}) {
  if (!fields.length) {
    return <p className="rounded-md border border-line bg-canvas p-4 text-sm text-moss">У этой категории нет дополнительных полей или API пока не вернул справочник.</p>;
  }
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {fields.map((field) => (
        <AvitoFieldControl
          key={field.key}
          field={field}
          value={values[field.key] ?? ""}
          onChange={(value) => onChange({ ...values, [field.key]: value })}
        />
      ))}
    </div>
  );
}

export function AvitoFieldControl({
  field,
  value,
  onChange,
}: {
  field: AvitoCatalogField;
  value: string;
  onChange: (value: string) => void;
}) {
  const values = useFieldValues(field);
  const label = `${field.label}${field.required ? " *" : ""}`;

  if (values.length) {
    return <SelectField label={label} value={value} options={["", ...values]} onChange={onChange} />;
  }
  if (field.type === "number") {
    return <NumberField label={label} value={Number(value || 0)} onChange={(next) => onChange(String(next))} />;
  }
  if (field.type === "boolean") {
    return <SelectField label={label} value={value} options={["", "true", "false"]} onChange={onChange} />;
  }
  if (field.type === "text") {
    return (
      <label className="block md:col-span-2">
        <span className="mb-1 block text-xs font-semibold text-moss">{label}</span>
        <textarea className="min-h-[96px] w-full rounded-md border-line text-sm" value={value} onChange={(event) => onChange(event.target.value)} />
        {field.help ? <span className="mt-1 block whitespace-pre-line text-xs text-moss">{field.help}</span> : null}
      </label>
    );
  }
  return <TextField label={label} value={value} onChange={onChange} placeholder={field.help} />;
}

export function LinkedSizePicker({
  field,
  selected,
  onChange,
}: {
  field: AvitoCatalogField;
  selected: string[];
  onChange: (sizes: string[]) => void;
}) {
  const values = useFieldValues(field);
  return <SizePicker selected={selected} options={values} onChange={onChange} />;
}

export function SizePicker({
  selected,
  options,
  onChange,
}: {
  selected: string[];
  options: string[];
  onChange: (sizes: string[]) => void;
}) {
  if (!options.length) {
    return (
      <label className="block">
        <span className="mb-1 block text-xs font-semibold text-moss">Размеры из Avito</span>
        <input
          className="h-10 w-full rounded-md border-line bg-white text-sm"
          placeholder="Например: S, M, L"
          value={selected.join(", ")}
          onChange={(event) =>
            onChange(
              event.target.value
                .split(",")
                .map((item) => item.trim())
                .filter(Boolean),
            )
          }
        />
      </label>
    );
  }

  return (
    <div>
      <p className="mb-2 text-xs font-semibold text-moss">Размеры из справочника Avito</p>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-8">
        {options.map((size) => {
          const active = selected.includes(size);
          return (
            <button
              key={size}
              className={`min-h-10 rounded-md border px-2 py-2 text-sm font-semibold ${
                active ? "border-sea bg-teal-50 text-sea" : "border-line bg-white hover:bg-canvas"
              }`}
              type="button"
              onClick={() => onChange(active ? selected.filter((item) => item !== size) : [...selected, size])}
            >
              {size}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function useFieldValues(field?: AvitoCatalogField) {
  const [linkedValues, setLinkedValues] = useState<string[]>([]);
  useEffect(() => {
    setLinkedValues([]);
    if (!field?.valuesLinkJson) return;
    requestJson<CatalogResponse<string[]>>(`/api/avito/catalog/field-values?url=${encodeURIComponent(field.valuesLinkJson)}`)
      .then((payload) => setLinkedValues(payload.data))
      .catch(() => setLinkedValues([]));
  }, [field?.valuesLinkJson]);
  if (!field) return [];
  return field.values.length ? field.values : linkedValues;
}

function makeGroup(color: string, price = 0): ColorGroupDraft {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    color,
    avitoColorValue: color,
    price,
    stockQty: 1,
    sizes: [],
    variantOverrides: {},
    description: "",
    avitoFields: {},
    supplierId: "",
    photos: [],
  };
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

function SectionHeading({ title, text }: { title: string; text: string }) {
  return (
    <div>
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-1 text-sm leading-6 text-moss">{text}</p>
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-line bg-canvas p-3">
      <p className="text-xs font-semibold uppercase text-moss">{label}</p>
      <p className="mt-1 break-words font-semibold">{value}</p>
    </div>
  );
}

function buildPlannedVariants(groups: ColorGroupDraft[], sizeField: AvitoCatalogField | undefined, basePrice: number, title: string): PlannedVariant[] {
  return groups.flatMap((group) =>
    variantRowsForGroup(group, sizeField, basePrice).map((row) => ({
      groupId: group.id,
      color: group.avitoColorValue || group.color,
      size: row.size,
      price: row.price,
      stockQty: row.stockQty,
      enabled: row.enabled,
      sku: makeSku(title || "ITEM", group.avitoColorValue || group.color, row.size),
      photoCount: group.photos.length,
    })),
  );
}

function variantRowsForGroup(group: ColorGroupDraft, sizeField: AvitoCatalogField | undefined, basePrice: number) {
  const sizes = sizeField ? group.sizes : [oneSizeValue];
  const defaultPrice = group.price || basePrice;
  return sizes.map((size) => {
    const override = group.variantOverrides[size];
    return {
      size,
      enabled: override?.enabled ?? true,
      price: Math.max(0, Math.round(override?.price ?? defaultPrice)),
      stockQty: Math.max(0, Math.round(override?.stockQty ?? group.stockQty)),
    };
  });
}

function validateWizard(input: {
  form: {
    title: string;
    brand: string;
    basePrice: number;
    avitoCategorySlug: string;
    avitoFields: Record<string, string>;
  };
  groups: ColorGroupDraft[];
  fields: AvitoCatalogField[];
  sizeField?: AvitoCatalogField;
  plannedVariants: PlannedVariant[];
}) {
  const { form, groups, fields, sizeField, plannedVariants } = input;
  const errors: string[] = [];
  const active = plannedVariants.filter((variant) => variant.enabled && variant.stockQty > 0);

  if (!form.title.trim()) errors.push("Укажите название товара.");
  if (form.basePrice <= 0) errors.push("Укажите базовую цену больше нуля.");
  if (!form.avitoCategorySlug) errors.push("Выберите конечную категорию Avito.");
  if (!groups.length) errors.push("Добавьте минимум один цвет.");
  if (groups.some((group) => !String(group.color || group.avitoColorValue).trim())) errors.push("У каждого цвета должно быть название.");
  if (sizeField && groups.some((group) => !group.sizes.length)) errors.push("Выберите размеры для каждого цвета.");
  if (!active.length) errors.push("Включите хотя бы одно объявление с остатком больше 0.");
  if (active.some((variant) => variant.price <= 0)) errors.push("Цена каждого активного объявления должна быть больше 0.");
  if (groups.some((group) => group.photos.length === 0 && variantRowsForGroup(group, sizeField, form.basePrice).some((variant) => variant.enabled && variant.stockQty > 0))) {
    errors.push("Загрузите фото для каждого цвета, который будет выгружаться.");
  }

  for (const field of fields.filter((item) => item.required)) {
    const role = getFieldRole(field);
    if (role === "brand" && !form.brand.trim()) errors.push(`Заполните обязательное поле: ${field.label}.`);
    if (role !== "brand" && role !== "color" && role !== "size" && !String(form.avitoFields[field.key] ?? "").trim()) {
      errors.push(`Заполните обязательное поле: ${field.label}.`);
    }
  }

  return [...new Set(errors)];
}

function normalizeFormForFields<T extends { brand: string; avitoFields: Record<string, string> }>(form: T, fields: AvitoCatalogField[]): T {
  const brandField = findFieldByRole(fields, "brand");
  return {
    ...form,
    brand: form.brand || (brandField ? form.avitoFields[brandField.key] ?? "" : ""),
  };
}

function normalizePresetSizes(sizes: string[], field?: AvitoCatalogField) {
  if (!field?.values.length) return sizes;
  const available = new Set(field.values.map((item) => item.toLowerCase()));
  const matched = sizes.filter((size) => available.has(size.toLowerCase()));
  return matched.length ? matched : sizes;
}

function flattenCategories(nodes: AvitoCategoryNode[]): AvitoCategoryNode[] {
  return nodes.flatMap((node) => [node, ...flattenCategories(node.children)]);
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, ImagePlus, Plus, Search, Trash2 } from "lucide-react";
import type { ClientSupplier } from "@/lib/client-types";
import type { AvitoCatalogField, AvitoCategoryNode } from "@/lib/avito/catalog";
import { findFieldByRole, getFieldRole, isProductCoreField, isVariantField } from "@/lib/avito/field-utils";
import { Button, NumberField, PageHeader, SelectField, TextField, requestJson } from "@/components/ui-kit";

type CatalogResponse<T> = { data: T; source: "api" | "cache" | "fallback"; warning?: string };

type ColorGroupDraft = {
  id: string;
  color: string;
  avitoColorValue: string;
  price: number;
  stockQty: number;
  sizes: string[];
  description: string;
  avitoFields: Record<string, string>;
  supplierId: string;
  photos: File[];
};

const steps = ["Основное", "Категория Avito", "Поля Avito", "Цвета и размеры", "Проверка"];
const oneSizeValue = "ONE_SIZE";

export function ProductWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
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
    description: "",
  });
  const [groups, setGroups] = useState<ColorGroupDraft[]>([
    makeGroup("Белый"),
    makeGroup("Черный"),
  ]);

  const flatCategories = useMemo(() => flattenCategories(tree), [tree]);
  const visibleCategories = useMemo(() => {
    const query = categoryQuery.trim().toLowerCase();
    const items = flatCategories.filter((category) => category.children.length === 0 || query);
    if (!query) return items.slice(0, 80);
    return items.filter((category) => category.path.toLowerCase().includes(query)).slice(0, 80);
  }, [flatCategories, categoryQuery]);

  const colorField = findFieldByRole(fields, "color");
  const sizeField = findFieldByRole(fields, "size");
  const brandField = findFieldByRole(fields, "brand");
  const categoryFields = fields.filter((field) => !isVariantField(field) && !isProductCoreField(field));
  const totalVariants = groups.reduce((sum, group) => sum + (sizeField ? group.sizes.length : 1), 0);
  const totalPhotos = groups.reduce((sum, group) => sum + group.photos.length, 0);

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
    const errors = localValidate();
    if (errors.length) {
      setToast(errors[0]);
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
          colorGroups: groups.map((group) => ({
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
          })),
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

  function localValidate() {
    const errors: string[] = [];
    if (!form.title.trim()) errors.push("Укажите название как в Avito.");
    if (form.basePrice <= 0) errors.push("Укажите базовую цену больше нуля.");
    if (!form.avitoCategorySlug) errors.push("Выберите конечную категорию Avito.");
    if (fields.length && fields.some((field) => field.required && !fieldValuePresent(field))) {
      errors.push("Заполните обязательные поля Avito.");
    }
    if (!groups.length) errors.push("Добавьте минимум один цвет.");
    if (groups.some((group) => !group.color.trim())) errors.push("У каждого цвета должно быть название.");
    if (groups.some((group) => group.price <= 0 && form.basePrice <= 0)) errors.push("У каждого цвета должна быть цена.");
    if (sizeField?.required && groups.some((group) => group.sizes.length === 0)) errors.push("Выберите размеры для каждого цвета.");
    if (groups.some((group) => group.photos.length === 0)) errors.push("Загрузите фото для каждого цвета.");
    return errors;
  }

  function fieldValuePresent(field: AvitoCatalogField) {
    const role = getFieldRole(field);
    if (role === "brand") return Boolean(form.brand.trim());
    if (role === "color" || role === "size") return true;
    return Boolean(String(form.avitoFields[field.key] ?? "").trim());
  }

  return (
    <>
      <PageHeader
        eyebrow="Новый товар"
        title="Массовая загрузка товара в Avito"
        actions={
          step === steps.length - 1 ? (
            <Button busy={busy} onClick={finish}>
              <Check className="h-4 w-4" />
              Создать товар
            </Button>
          ) : null
        }
      />
      <div className="grid gap-4 p-4 xl:grid-cols-[270px_minmax(0,1fr)] xl:p-6">
        <aside className="rounded-md border border-line bg-white p-3 shadow-panel">
          {steps.map((label, index) => (
            <button
              key={label}
              className={`flex h-11 w-full items-center gap-3 rounded-md px-3 text-left text-sm font-semibold ${
                step === index ? "bg-teal-50 text-sea" : "text-zinc-700 hover:bg-canvas"
              }`}
              type="button"
              onClick={() => setStep(index)}
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-full border border-line text-xs">{index + 1}</span>
              {label}
            </button>
          ))}
          <div className="mt-4 rounded-md bg-canvas p-3 text-xs leading-5 text-moss">
            Источник справочника: <span className="font-semibold uppercase">{catalogSource}</span>
            {catalogWarning ? <p className="mt-2 text-amber-700">{catalogWarning}</p> : null}
          </div>
        </aside>

        <section className="rounded-md border border-line bg-white p-5 shadow-panel">
          {step === 0 ? (
            <div className="space-y-5">
              <Intro title="Основные данные" text="Один товар = один бренд и одна категория. Цвета и размеры добавляются дальше матрицей." />
              <div className="grid gap-4 md:grid-cols-3">
                <TextField label="Название" value={form.title} onChange={(title) => setForm((item) => ({ ...item, title }))} />
                <TextField label="Бренд" value={form.brand} onChange={(brand) => setForm((item) => ({ ...item, brand }))} />
                <NumberField label="Базовая цена" value={form.basePrice} onChange={(basePrice) => setForm((item) => ({ ...item, basePrice }))} />
              </div>
              <SupplierSelect
                label="Поставщик по умолчанию"
                value={form.supplierId}
                suppliers={suppliers}
                onChange={(supplierId) => setForm((item) => ({ ...item, supplierId }))}
              />
            </div>
          ) : null}

          {step === 1 ? (
            <div className="space-y-4">
              <Intro title="Категория из Avito API" text="Выбирайте конечную категорию. От нее зависят обязательные поля, цвета и размеры." />
              <label className="relative block">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-moss" />
                <input
                  className="h-10 w-full rounded-md border-line pl-9 text-sm"
                  placeholder="Поиск по дереву Avito"
                  value={categoryQuery}
                  onChange={(event) => setCategoryQuery(event.target.value)}
                />
              </label>
              <div className="max-h-[420px] overflow-y-auto rounded-md border border-line">
                {visibleCategories.map((category) => (
                  <button
                    key={category.slug}
                    className={`block w-full border-b border-line px-3 py-3 text-left text-sm last:border-b-0 ${
                      category.slug === form.avitoCategorySlug ? "bg-teal-50 text-sea" : "bg-white hover:bg-canvas"
                    }`}
                    type="button"
                    onClick={() => {
                      setForm((item) => ({
                        ...item,
                        avitoCategorySlug: category.slug,
                        avitoCategoryName: category.path,
                        avitoFields: {},
                      }));
                      setStep(2);
                    }}
                  >
                    <span className="font-semibold">{category.name}</span>
                    <span className="mt-1 block text-xs text-moss">{category.path}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="space-y-4">
              <Intro title="Поля выбранной категории" text="Это параметры, которые Avito вернул для выбранной категории. Обязательные отмечены звездочкой." />
              <DynamicFields fields={categoryFields} values={form.avitoFields} onChange={(avitoFields) => setForm((item) => ({ ...item, avitoFields }))} />
            </div>
          ) : null}

          {step === 3 ? (
            <ColorMatrix
              colorField={colorField}
              sizeField={sizeField}
              groups={groups}
              basePrice={form.basePrice}
              suppliers={suppliers}
              onChange={setGroups}
            />
          ) : null}

          {step === 4 ? (
            <div className="space-y-4">
              <Intro title="Проверка перед созданием" text="Проверьте матрицу. После создания товар можно отправить в Avito через скрытый Autoload API-flow." />
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-moss">Общее описание</span>
                <textarea
                  className="min-h-[160px] w-full rounded-md border-line text-sm"
                  value={form.description}
                  onChange={(event) => setForm((item) => ({ ...item, description: event.target.value }))}
                />
              </label>
              <div className="grid gap-3 md:grid-cols-4">
                <Summary label="Категория" value={form.avitoCategoryName || "Не выбрана"} />
                <Summary label="Цветов" value={groups.length} />
                <Summary label="Вариантов" value={totalVariants} />
                <Summary label="Фото" value={totalPhotos} />
              </div>
            </div>
          ) : null}

          <div className="mt-6 flex flex-wrap justify-between gap-2 border-t border-line pt-4">
            <Button tone="secondary" disabled={step === 0} onClick={() => setStep((item) => Math.max(0, item - 1))}>
              <ArrowLeft className="h-4 w-4" />
              Назад
            </Button>
            {step < steps.length - 1 ? (
              <Button onClick={() => setStep((item) => Math.min(steps.length - 1, item + 1))}>
                Далее
                <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button busy={busy} onClick={finish}>
                <Check className="h-4 w-4" />
                Создать
              </Button>
            )}
          </div>
          {toast ? <p className="mt-4 rounded-md bg-red-50 p-3 text-sm font-semibold text-red-700">{toast}</p> : null}
        </section>
      </div>
    </>
  );
}

function ColorMatrix({
  colorField,
  sizeField,
  groups,
  basePrice,
  suppliers,
  onChange,
}: {
  colorField?: AvitoCatalogField;
  sizeField?: AvitoCatalogField;
  groups: ColorGroupDraft[];
  basePrice: number;
  suppliers: ClientSupplier[];
  onChange: (groups: ColorGroupDraft[]) => void;
}) {
  function update(id: string, patch: Partial<ColorGroupDraft>) {
    onChange(groups.map((group) => (group.id === id ? { ...group, ...patch } : group)));
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <Intro title="Цветовые группы и размеры" text="Для каждого цвета задайте свои фото, цену и размеры. Все размеры пойдут отдельными вариантами." />
        <Button tone="secondary" onClick={() => onChange([...groups, makeGroup("Новый цвет", basePrice)])}>
          <Plus className="h-4 w-4" />
          Цвет
        </Button>
      </div>
      <div className="space-y-4">
        {groups.map((group, index) => (
          <div key={group.id} className="rounded-md border border-line bg-canvas p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <p className="font-semibold">Цвет #{index + 1}</p>
              <Button tone="danger" disabled={groups.length === 1} onClick={() => onChange(groups.filter((item) => item.id !== group.id))}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <div className="grid gap-4 md:grid-cols-4">
              {colorField ? (
                <AvitoFieldControl
                  field={colorField}
                  value={group.avitoColorValue || group.color}
                  onChange={(value) => update(group.id, { color: value, avitoColorValue: value })}
                />
              ) : (
                <TextField label="Цвет" value={group.color} onChange={(color) => update(group.id, { color, avitoColorValue: color })} />
              )}
              <NumberField label="Цена цвета" value={group.price || basePrice} onChange={(price) => update(group.id, { price })} />
              <NumberField label="Остаток на размер" value={group.stockQty} onChange={(stockQty) => update(group.id, { stockQty })} />
              <SupplierSelect
                label="Поставщик цвета"
                value={group.supplierId}
                suppliers={suppliers}
                onChange={(supplierId) => update(group.id, { supplierId })}
              />
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-moss">Фото цвета</span>
                <input
                  className="block w-full rounded-md border border-line bg-white text-sm file:mr-3 file:h-10 file:border-0 file:bg-sea file:px-3 file:text-sm file:font-semibold file:text-white"
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(event) => update(group.id, { photos: Array.from(event.target.files ?? []) })}
                />
              </label>
              <div className="md:col-span-4">
                {sizeField ? (
                  <LinkedSizePicker field={sizeField} selected={group.sizes} onChange={(sizes) => update(group.id, { sizes })} />
                ) : (
                  <p className="rounded-md border border-line bg-white p-3 text-sm text-moss">
                    В этой категории Avito не вернул размерное поле. Будет создан один вариант без размера.
                  </p>
                )}
              </div>
              <label className="block md:col-span-4">
                <span className="mb-1 block text-xs font-semibold text-moss">Описание именно для этого цвета</span>
                <textarea
                  className="min-h-[90px] w-full rounded-md border-line text-sm"
                  value={group.description}
                  onChange={(event) => update(group.id, { description: event.target.value })}
                />
              </label>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-moss">
              <span className="rounded bg-white px-2 py-1">{sizeField ? group.sizes.length : 1} вариантов</span>
              <span className="rounded bg-white px-2 py-1">{group.photos.length} фото</span>
            </div>
          </div>
        ))}
      </div>
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

function useFieldValues(field: AvitoCatalogField) {
  const [linkedValues, setLinkedValues] = useState<string[]>([]);
  useEffect(() => {
    setLinkedValues([]);
    if (!field.valuesLinkJson) return;
    requestJson<CatalogResponse<string[]>>(`/api/avito/catalog/field-values?url=${encodeURIComponent(field.valuesLinkJson)}`)
      .then((payload) => setLinkedValues(payload.data))
      .catch(() => setLinkedValues([]));
  }, [field.valuesLinkJson]);
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

function Intro({ title, text }: { title: string; text: string }) {
  return (
    <div>
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-1 text-sm leading-6 text-moss">{text}</p>
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-line bg-canvas p-4">
      <p className="text-xs font-semibold uppercase text-moss">{label}</p>
      <p className="mt-2 break-words font-semibold">{value}</p>
    </div>
  );
}

function normalizeFormForFields<T extends { brand: string; avitoFields: Record<string, string> }>(form: T, fields: AvitoCatalogField[]): T {
  const brandField = findFieldByRole(fields, "brand");
  return {
    ...form,
    brand: form.brand || (brandField ? form.avitoFields[brandField.key] ?? "" : ""),
  };
}

function flattenCategories(nodes: AvitoCategoryNode[]): AvitoCategoryNode[] {
  return nodes.flatMap((node) => [node, ...flattenCategories(node.children)]);
}

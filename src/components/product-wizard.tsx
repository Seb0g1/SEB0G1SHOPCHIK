"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, ImagePlus, PackagePlus, Search } from "lucide-react";
import type { AvitoCatalogField, AvitoCategoryNode } from "@/lib/avito/catalog";
import { findFieldByRole, getFieldRole, isProductCoreField, isVariantField } from "@/lib/avito/field-utils";
import { Button, NumberField, PageHeader, SelectField, TextField, requestJson } from "@/components/ui-kit";

type CatalogResponse<T> = { data: T; source: "api" | "cache" | "fallback"; warning?: string };

const steps = ["Основное", "Категория Avito", "Поля Avito", "Фото", "Цвет и размеры", "Проверка"];
const oneSizeValue = "ONE_SIZE";

export function ProductWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");
  const [categoryQuery, setCategoryQuery] = useState("");
  const [catalogSource, setCatalogSource] = useState<"api" | "cache" | "fallback">("fallback");
  const [catalogWarning, setCatalogWarning] = useState("");
  const [tree, setTree] = useState<AvitoCategoryNode[]>([]);
  const [fields, setFields] = useState<AvitoCatalogField[]>([]);
  const [photos, setPhotos] = useState<File[]>([]);
  const [form, setForm] = useState({
    title: "",
    brand: "",
    basePrice: 0,
    color: "",
    stockQty: 1,
    sizes: [] as string[],
    avitoCategorySlug: "",
    avitoCategoryName: "",
    avitoFields: {} as Record<string, string>,
    description: "",
  });

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

  useEffect(() => {
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
    requestJson<CatalogResponse<AvitoCatalogField[]>>(
      `/api/avito/catalog/nodes/${encodeURIComponent(form.avitoCategorySlug)}/fields`,
    )
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
      setStep(Math.min(step, steps.length - 1));
      return;
    }

    setBusy(true);
    setToast("");
    try {
      const avitoFields = syncCoreFields(form.avitoFields);
      const selectedSizes = sizeField ? form.sizes : [oneSizeValue];
      const variantColor = form.color.trim() || "Без цвета";
      const payload = await requestJson<{ product: { id: string } }>("/api/products", {
        method: "POST",
        body: JSON.stringify({
          title: form.title,
          brand: form.brand,
          basePrice: form.basePrice,
          color: variantColor,
          sizes: selectedSizes,
          stockQty: form.stockQty,
          avitoCategorySlug: form.avitoCategorySlug,
          avitoCategoryName: form.avitoCategoryName,
          avitoFields,
        }),
      });

      await requestJson(`/api/products/${payload.product.id}`, {
        method: "PATCH",
        body: JSON.stringify({ description: form.description, avitoFields }),
      });

      if (photos.length) {
        const data = new FormData();
        data.append("color", variantColor);
        photos.forEach((file) => data.append("files", file));
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
      ...(colorField ? { [colorField.key]: form.color } : {}),
      ...(sizeField && form.sizes.length === 1 ? { [sizeField.key]: form.sizes[0] } : {}),
    };
  }

  function localValidate() {
    const errors: string[] = [];
    if (!form.title.trim()) errors.push("Укажите название как в Avito.");
    if (form.basePrice <= 0) errors.push("Укажите цену больше нуля.");
    if (!form.avitoCategorySlug) errors.push("Выберите конечную категорию из справочника Avito.");
    if (fields.length && fields.some((field) => field.required && !fieldValuePresent(field))) {
      errors.push("Заполните обязательные поля Avito перед созданием.");
    }
    if (!form.color.trim() && colorField?.required) errors.push("Выберите цвет из поля Avito.");
    if (sizeField?.required && form.sizes.length === 0) errors.push("Выберите размеры из поля Avito.");
    return errors;
  }

  function fieldValuePresent(field: AvitoCatalogField) {
    const role = getFieldRole(field);
    if (role === "brand") return Boolean(form.brand.trim());
    if (role === "color") return Boolean(form.color.trim());
    if (role === "size") return !sizeField || form.sizes.length > 0;
    return Boolean(String(form.avitoFields[field.key] ?? "").trim());
  }

  return (
    <>
      <PageHeader
        eyebrow="Новый товар"
        title="Загрузка товара по полям Avito"
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
              <span className="flex h-6 w-6 items-center justify-center rounded-full border border-line text-xs">
                {index + 1}
              </span>
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
              <div>
                <h2 className="text-lg font-semibold">Основные данные объявления</h2>
                <p className="mt-1 text-sm text-moss">Только поля, которые есть в карточке Avito: название, бренд и цена.</p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <TextField label="Название" value={form.title} onChange={(title) => setForm((item) => ({ ...item, title }))} />
                <TextField label="Бренд" value={form.brand} onChange={(brand) => setForm((item) => ({ ...item, brand }))} />
                <NumberField
                  label="Цена"
                  value={form.basePrice}
                  onChange={(basePrice) => setForm((item) => ({ ...item, basePrice }))}
                />
              </div>
            </div>
          ) : null}

          {step === 1 ? (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold">Категория из Avito API</h2>
                <p className="mt-1 text-sm text-moss">Выбирайте конечную категорию: от нее зависят поля, размеры и справочники.</p>
              </div>
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
                {visibleCategories.map((category) => {
                  const active = category.slug === form.avitoCategorySlug;
                  return (
                    <button
                      key={category.slug}
                      className={`block w-full border-b border-line px-3 py-3 text-left text-sm last:border-b-0 ${
                        active ? "bg-teal-50 text-sea" : "bg-white hover:bg-canvas"
                      }`}
                      type="button"
                      onClick={() => {
                        setForm((item) => ({
                          ...item,
                          avitoCategorySlug: category.slug,
                          avitoCategoryName: category.path,
                          avitoFields: {},
                          sizes: [],
                        }));
                        setStep(2);
                      }}
                    >
                      <span className="font-semibold">{category.name}</span>
                      <span className="mt-1 block text-xs text-moss">{category.path}</span>
                    </button>
                  );
                })}
              </div>
              {!visibleCategories.length ? <p className="rounded-md bg-canvas p-4 text-sm text-moss">Категории не найдены.</p> : null}
            </div>
          ) : null}

          {step === 2 ? (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold">Параметры выбранной категории</h2>
                <p className="mt-1 text-sm text-moss">
                  Здесь показываются обязательные и дополнительные поля, которые пришли из Avito API.
                </p>
              </div>
              <DynamicFields
                fields={categoryFields}
                values={form.avitoFields}
                onChange={(avitoFields) => setForm((item) => ({ ...item, avitoFields }))}
              />
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold">Фото товара</h2>
                <p className="mt-1 text-sm text-moss">Загрузите реальные фото товара. Они пойдут в карточки вариантов.</p>
              </div>
              <label className="flex min-h-[220px] cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-line bg-canvas p-6 text-center">
                <ImagePlus className="h-10 w-10 text-sea" />
                <span className="mt-3 text-sm font-semibold">Загрузить фото</span>
                <input
                  className="mt-4 block text-sm"
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(event) => setPhotos(Array.from(event.target.files ?? []))}
                />
              </label>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
                {photos.map((file) => (
                  <div key={`${file.name}-${file.size}`} className="rounded-md border border-line bg-white p-2 text-sm">
                    {file.name}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {step === 4 ? (
            <VariantStep
              colorField={colorField}
              sizeField={sizeField}
              color={form.color}
              sizes={form.sizes}
              stockQty={form.stockQty}
              onColorChange={(color) => setForm((item) => ({ ...item, color }))}
              onSizesChange={(sizes) => setForm((item) => ({ ...item, sizes }))}
              onStockChange={(stockQty) => setForm((item) => ({ ...item, stockQty }))}
            />
          ) : null}

          {step === 5 ? (
            <div className="space-y-4">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-moss">Описание</span>
                <textarea
                  className="min-h-[180px] w-full rounded-md border-line text-sm"
                  value={form.description}
                  onChange={(event) => setForm((item) => ({ ...item, description: event.target.value }))}
                />
              </label>
              <div className="rounded-md border border-line bg-canvas p-4">
                <p className="font-semibold">{form.title || "Название не заполнено"}</p>
                <p className="mt-2 text-sm text-moss">
                  {form.avitoCategoryName || "Категория не выбрана"} · {form.color || "цвет не выбран"} ·{" "}
                  {sizeField ? form.sizes.join(", ") || "размеры не выбраны" : "без размерной сетки"} · {photos.length} фото
                </p>
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
                <PackagePlus className="h-4 w-4" />
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
      <DelimitedListField
        label="Размеры из Avito"
        value={selected}
        placeholder="Например: S, M, L"
        onChange={onChange}
      />
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

function VariantStep({
  colorField,
  sizeField,
  color,
  sizes,
  stockQty,
  onColorChange,
  onSizesChange,
  onStockChange,
}: {
  colorField?: AvitoCatalogField;
  sizeField?: AvitoCatalogField;
  color: string;
  sizes: string[];
  stockQty: number;
  onColorChange: (value: string) => void;
  onSizesChange: (value: string[]) => void;
  onStockChange: (value: number) => void;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold">Цвет и размеры по Avito</h2>
        <p className="mt-1 text-sm text-moss">
          Если категория содержит поле размера, варианты создаются только из значений этого поля.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {colorField ? (
          <AvitoFieldControl field={colorField} value={color} onChange={onColorChange} />
        ) : (
          <TextField label="Цвет" value={color} onChange={onColorChange} />
        )}
        <NumberField label="Остаток на каждый вариант" value={stockQty} onChange={onStockChange} />
      </div>
      {sizeField ? (
        <LinkedSizePicker field={sizeField} selected={sizes} onChange={onSizesChange} />
      ) : (
        <div className="rounded-md border border-line bg-canvas p-4 text-sm text-moss">
          В этой категории Avito не вернул поле размера. Будет создан один вариант без размерной сетки.
        </div>
      )}
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
        {field.help ? <span className="mt-1 block text-xs text-moss">{field.help}</span> : null}
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

function DelimitedListField({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string[];
  placeholder: string;
  onChange: (value: string[]) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-moss">{label}</span>
      <input
        className="h-10 w-full rounded-md border-line bg-white text-sm"
        placeholder={placeholder}
        value={value.join(", ")}
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

function normalizeFormForFields<T extends { brand: string; color: string; sizes: string[]; avitoFields: Record<string, string> }>(
  form: T,
  fields: AvitoCatalogField[],
): T {
  const brandField = findFieldByRole(fields, "brand");
  const colorField = findFieldByRole(fields, "color");
  const sizeField = findFieldByRole(fields, "size");
  return {
    ...form,
    brand: form.brand || (brandField ? form.avitoFields[brandField.key] ?? "" : ""),
    color: form.color || (colorField ? form.avitoFields[colorField.key] ?? "" : ""),
    sizes: sizeField ? form.sizes : [],
  };
}

function flattenCategories(nodes: AvitoCategoryNode[]): AvitoCategoryNode[] {
  return nodes.flatMap((node) => [node, ...flattenCategories(node.children)]);
}

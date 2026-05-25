"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, ImagePlus, PackagePlus, Sparkles } from "lucide-react";
import type { AvitoCatalogField, AvitoCategoryNode } from "@/lib/avito/catalog";
import { CLOTHING_SIZES } from "@/lib/catalog";
import { Button, NumberField, PageHeader, SelectField, TextField, requestJson } from "@/components/ui-kit";

type CatalogResponse<T> = { data: T; source: "api" | "cache" | "fallback"; warning?: string };

const steps = ["Основное", "Категория", "Параметры", "Фото", "Варианты", "Проверка"];

export function ProductWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");
  const [tree, setTree] = useState<AvitoCategoryNode[]>([]);
  const [fields, setFields] = useState<AvitoCatalogField[]>([]);
  const [photos, setPhotos] = useState<File[]>([]);
  const [form, setForm] = useState({
    title: "Футболка Nike Forza Nocta",
    brand: "Nike",
    basePrice: 2199,
    color: "Белый",
    stockQty: 3,
    sizes: ["S", "M", "L", "XL"],
    avitoCategorySlug: "",
    avitoCategoryName: "",
    avitoFields: {} as Record<string, string>,
    description: "",
  });

  const flatCategories = useMemo(() => flattenCategories(tree), [tree]);
  const selectedCategory = flatCategories.find((item) => item.slug === form.avitoCategorySlug);

  useEffect(() => {
    requestJson<CatalogResponse<AvitoCategoryNode[]>>("/api/avito/catalog/tree")
      .then((payload) => setTree(payload.data))
      .catch((error) => setToast(error instanceof Error ? error.message : "Не удалось загрузить категории"));
  }, []);

  useEffect(() => {
    if (!form.avitoCategorySlug) return;
    requestJson<CatalogResponse<AvitoCatalogField[]>>(
      `/api/avito/catalog/nodes/${encodeURIComponent(form.avitoCategorySlug)}/fields`,
    )
      .then((payload) => setFields(payload.data))
      .catch((error) => setToast(error instanceof Error ? error.message : "Не удалось загрузить поля категории"));
  }, [form.avitoCategorySlug]);

  async function finish() {
    setBusy(true);
    setToast("");
    try {
      const payload = await requestJson<{ product: { id: string } }>("/api/products", {
        method: "POST",
        body: JSON.stringify({
          title: form.title,
          brand: form.brand,
          basePrice: form.basePrice,
          color: form.color,
          sizes: form.sizes,
          stockQty: form.stockQty,
          avitoCategorySlug: form.avitoCategorySlug,
          avitoCategoryName: form.avitoCategoryName,
          avitoFields: form.avitoFields,
        }),
      });

      await requestJson(`/api/products/${payload.product.id}`, {
        method: "PATCH",
        body: JSON.stringify({ description: form.description, avitoFields: form.avitoFields }),
      });

      if (photos.length) {
        const data = new FormData();
        data.append("color", form.color);
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

  return (
    <>
      <PageHeader
        eyebrow="Новый товар"
        title="Мастер загрузки товара"
        actions={
          step === steps.length - 1 ? (
            <Button busy={busy} onClick={finish}>
              <Check className="h-4 w-4" />
              Создать товар
            </Button>
          ) : null
        }
      />
      <div className="grid gap-4 p-4 xl:grid-cols-[260px_minmax(0,1fr)] xl:p-6">
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
        </aside>

        <section className="rounded-md border border-line bg-white p-5 shadow-panel">
          {step === 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              <TextField label="Название" value={form.title} onChange={(title) => setForm((item) => ({ ...item, title }))} />
              <TextField label="Бренд" value={form.brand} onChange={(brand) => setForm((item) => ({ ...item, brand }))} />
              <NumberField
                label="Цена"
                value={form.basePrice}
                onChange={(basePrice) => setForm((item) => ({ ...item, basePrice }))}
              />
              <TextField label="Базовый цвет" value={form.color} onChange={(color) => setForm((item) => ({ ...item, color }))} />
            </div>
          ) : null}

          {step === 1 ? (
            <div className="space-y-4">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-moss">Категория Avito</span>
                <select
                  className="h-10 w-full rounded-md border-line bg-white text-sm"
                  value={form.avitoCategorySlug}
                  onChange={(event) => {
                    const category = flatCategories.find((item) => item.slug === event.target.value);
                    setForm((item) => ({
                      ...item,
                      avitoCategorySlug: event.target.value,
                      avitoCategoryName: category?.path || "",
                    }));
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
              {selectedCategory ? <p className="text-sm font-semibold text-moss">{selectedCategory.path}</p> : null}
            </div>
          ) : null}

          {step === 2 ? (
            <DynamicFields
              fields={fields}
              values={form.avitoFields}
              onChange={(avitoFields) => setForm((item) => ({ ...item, avitoFields }))}
            />
          ) : null}

          {step === 3 ? (
            <div className="space-y-4">
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
            <div className="grid gap-4 md:grid-cols-2">
              <NumberField label="Остаток на размер" value={form.stockQty} onChange={(stockQty) => setForm((item) => ({ ...item, stockQty }))} />
              <TextField label="Цвет вариантов" value={form.color} onChange={(color) => setForm((item) => ({ ...item, color }))} />
              <div className="md:col-span-2">
                <SizePicker selected={form.sizes} onChange={(sizes) => setForm((item) => ({ ...item, sizes }))} />
              </div>
            </div>
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
                <p className="font-semibold">{form.title}</p>
                <p className="mt-2 text-sm text-moss">
                  {form.avitoCategoryName || "Категория не выбрана"} · {form.sizes.join(", ")} · {photos.length} фото
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
    return <p className="rounded-md border border-line bg-canvas p-4 text-sm text-moss">Поля категории пока не загружены.</p>;
  }
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {fields.map((field) =>
        field.values.length ? (
          <SelectField
            key={field.key}
            label={`${field.label}${field.required ? " *" : ""}`}
            value={values[field.key] ?? ""}
            options={["", ...field.values]}
            onChange={(value) => onChange({ ...values, [field.key]: value })}
          />
        ) : field.type === "number" ? (
          <NumberField
            key={field.key}
            label={`${field.label}${field.required ? " *" : ""}`}
            value={Number(values[field.key] ?? 0)}
            onChange={(value) => onChange({ ...values, [field.key]: String(value) })}
          />
        ) : (
          <TextField
            key={field.key}
            label={`${field.label}${field.required ? " *" : ""}`}
            value={values[field.key] ?? ""}
            onChange={(value) => onChange({ ...values, [field.key]: value })}
          />
        ),
      )}
    </div>
  );
}

export function SizePicker({ selected, onChange }: { selected: string[]; onChange: (sizes: string[]) => void }) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold text-moss">Размеры</p>
      <div className="grid grid-cols-4 gap-2 md:grid-cols-8">
        {CLOTHING_SIZES.map((size) => {
          const active = selected.includes(size);
          return (
            <button
              key={size}
              className={`h-10 rounded-md border text-sm font-semibold ${
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

function flattenCategories(nodes: AvitoCategoryNode[]): AvitoCategoryNode[] {
  return nodes.flatMap((node) => [node, ...flattenCategories(node.children)]);
}

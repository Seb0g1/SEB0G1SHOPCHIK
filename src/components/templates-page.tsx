"use client";

import { Plus, Save, Trash2 } from "lucide-react";
import { useState } from "react";
import type { ClientReplyTemplate } from "@/lib/client-types";
import { Button, NumberField, PageHeader, TextField, requestJson } from "@/components/ui-kit";

type TemplateDraft = Pick<
  ClientReplyTemplate,
  "name" | "ratingMin" | "ratingMax" | "keywords" | "text" | "priority" | "active"
>;

const emptyTemplate: TemplateDraft = {
  name: "",
  ratingMin: 5,
  ratingMax: 5,
  keywords: "",
  text: "Спасибо, {name}! Будем рады видеть вас снова в {shopName}.",
  priority: 60,
  active: true,
};

export function TemplatesPage({ initialTemplates }: { initialTemplates: ClientReplyTemplate[] }) {
  const [templates, setTemplates] = useState(initialTemplates);
  const [drafts, setDrafts] = useState<Record<string, TemplateDraft>>(() =>
    Object.fromEntries(initialTemplates.map((template) => [template.id, toDraft(template)])),
  );
  const [newTemplate, setNewTemplate] = useState<TemplateDraft>(emptyTemplate);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");

  async function reload() {
    const payload = await requestJson<{ templates: ClientReplyTemplate[] }>("/api/templates");
    setTemplates(payload.templates);
    setDrafts(Object.fromEntries(payload.templates.map((template) => [template.id, toDraft(template)])));
  }

  async function create() {
    setBusy("create");
    setMessage("");
    try {
      await requestJson("/api/templates", { method: "POST", body: JSON.stringify(newTemplate) });
      setNewTemplate(emptyTemplate);
      await reload();
      setMessage("Шаблон добавлен.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось добавить шаблон");
    } finally {
      setBusy("");
    }
  }

  async function save(id: string) {
    setBusy(id);
    setMessage("");
    try {
      await requestJson(`/api/templates/${id}`, { method: "PATCH", body: JSON.stringify(drafts[id]) });
      await reload();
      setMessage("Шаблон сохранен.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось сохранить шаблон");
    } finally {
      setBusy("");
    }
  }

  async function remove(id: string) {
    setBusy(id);
    setMessage("");
    try {
      await requestJson(`/api/templates/${id}`, { method: "DELETE" });
      await reload();
      setMessage("Шаблон удален.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось удалить шаблон");
    } finally {
      setBusy("");
    }
  }

  return (
    <>
      <PageHeader eyebrow="Онлайн и отзывы" title="Шаблоны ответов" />
      <div className="space-y-4 p-4 xl:p-6">
        <section className="rounded-md border border-line bg-white p-5 shadow-panel">
          <div className="mb-4">
            <h2 className="text-lg font-semibold">Новое правило</h2>
            <p className="mt-1 text-sm text-moss">
              Переменные: {"{name}"}, {"{rating}"}, {"{itemTitle}"}, {"{brand}"}, {"{shopName}"}.
            </p>
          </div>
          <div className="grid gap-4 lg:grid-cols-4">
            <TextField label="Название" value={newTemplate.name} onChange={(name) => setNewTemplate({ ...newTemplate, name })} />
            <NumberField
              label="Рейтинг от"
              value={newTemplate.ratingMin}
              onChange={(ratingMin) => setNewTemplate({ ...newTemplate, ratingMin })}
            />
            <NumberField
              label="Рейтинг до"
              value={newTemplate.ratingMax}
              onChange={(ratingMax) => setNewTemplate({ ...newTemplate, ratingMax })}
            />
            <NumberField
              label="Приоритет"
              value={newTemplate.priority}
              onChange={(priority) => setNewTemplate({ ...newTemplate, priority })}
            />
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
            <TextField
              label="Ключевые слова"
              placeholder="качество, доставка"
              value={newTemplate.keywords}
              onChange={(keywords) => setNewTemplate({ ...newTemplate, keywords })}
            />
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-moss">Текст ответа</span>
              <textarea
                className="min-h-[96px] w-full rounded-md border-line text-sm leading-6"
                value={newTemplate.text}
                onChange={(event) => setNewTemplate({ ...newTemplate, text: event.target.value })}
              />
            </label>
          </div>
          <div className="mt-4 flex items-center justify-between gap-3">
            <label className="inline-flex items-center gap-2 text-sm font-semibold text-moss">
              <input
                className="rounded border-line text-sea"
                checked={newTemplate.active}
                type="checkbox"
                onChange={(event) => setNewTemplate({ ...newTemplate, active: event.target.checked })}
              />
              Активный шаблон
            </label>
            <Button busy={busy === "create"} disabled={!newTemplate.name.trim() || !newTemplate.text.trim()} onClick={create}>
              <Plus className="h-4 w-4" />
              Добавить
            </Button>
          </div>
        </section>

        {message ? <p className="rounded-md border border-line bg-white p-3 text-sm font-semibold text-moss">{message}</p> : null}

        <div className="space-y-3">
          {templates.map((template) => {
            const draft = drafts[template.id] ?? toDraft(template);
            return (
              <section key={template.id} className="rounded-md border border-line bg-white p-5 shadow-panel">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="font-semibold">{template.name}</h2>
                    <p className="mt-1 text-sm text-moss">
                      {template.ratingMin}-{template.ratingMax}★ · приоритет {template.priority}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button tone="secondary" busy={busy === template.id} onClick={() => save(template.id)}>
                      <Save className="h-4 w-4" />
                      Сохранить
                    </Button>
                    <Button tone="danger" busy={busy === template.id} onClick={() => remove(template.id)}>
                      <Trash2 className="h-4 w-4" />
                      Удалить
                    </Button>
                  </div>
                </div>
                <div className="mt-4 grid gap-4 lg:grid-cols-4">
                  <TextField label="Название" value={draft.name} onChange={(name) => setDraft(template.id, { name })} />
                  <NumberField label="Рейтинг от" value={draft.ratingMin} onChange={(ratingMin) => setDraft(template.id, { ratingMin })} />
                  <NumberField label="Рейтинг до" value={draft.ratingMax} onChange={(ratingMax) => setDraft(template.id, { ratingMax })} />
                  <NumberField label="Приоритет" value={draft.priority} onChange={(priority) => setDraft(template.id, { priority })} />
                </div>
                <div className="mt-4 grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
                  <TextField
                    label="Ключевые слова"
                    value={draft.keywords}
                    onChange={(keywords) => setDraft(template.id, { keywords })}
                  />
                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold text-moss">Текст ответа</span>
                    <textarea
                      className="min-h-[110px] w-full rounded-md border-line text-sm leading-6"
                      value={draft.text}
                      onChange={(event) => setDraft(template.id, { text: event.target.value })}
                    />
                  </label>
                </div>
                <label className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-moss">
                  <input
                    className="rounded border-line text-sea"
                    checked={draft.active}
                    type="checkbox"
                    onChange={(event) => setDraft(template.id, { active: event.target.checked })}
                  />
                  Использовать при подборе
                </label>
              </section>
            );
          })}
        </div>
      </div>
    </>
  );

  function setDraft(id: string, patch: Partial<TemplateDraft>) {
    setDrafts((current) => ({
      ...current,
      [id]: { ...(current[id] ?? emptyTemplate), ...patch },
    }));
  }
}

function toDraft(template: ClientReplyTemplate): TemplateDraft {
  return {
    name: template.name,
    ratingMin: template.ratingMin,
    ratingMax: template.ratingMax,
    keywords: template.keywords,
    text: template.text,
    priority: template.priority,
    active: template.active,
  };
}

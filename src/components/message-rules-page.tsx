"use client";

import { Plus, Save, Trash2 } from "lucide-react";
import { useState } from "react";
import type { ClientMessageRule } from "@/lib/client-types";
import { Button, NumberField, PageHeader, TextField, requestJson } from "@/components/ui-kit";

type RuleDraft = {
  name: string;
  keywords: string;
  responseText: string;
  priority: number;
  cooldownSeconds: number;
  oncePerChat: boolean;
  active: boolean;
};

const emptyDraft: RuleDraft = {
  name: "",
  keywords: "",
  responseText: "",
  priority: 0,
  cooldownSeconds: 900,
  oncePerChat: true,
  active: true,
};

export function MessageRulesPage({ initialRules }: { initialRules: ClientMessageRule[] }) {
  const [rules, setRules] = useState(initialRules);
  const [draft, setDraft] = useState<RuleDraft>(emptyDraft);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState("");

  async function refresh() {
    const payload = await requestJson<{ rules: ClientMessageRule[] }>("/api/message-rules");
    setRules(payload.rules);
  }

  async function create() {
    setBusy("create");
    setMessage("");
    try {
      await requestJson("/api/message-rules", { method: "POST", body: JSON.stringify(draft) });
      setDraft(emptyDraft);
      await refresh();
      setMessage("Правило добавлено.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось добавить правило");
    } finally {
      setBusy("");
    }
  }

  async function patch(id: string, payload: Partial<RuleDraft>) {
    setBusy(id);
    setMessage("");
    try {
      await requestJson(`/api/message-rules/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
      await refresh();
      setMessage("Правило сохранено.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось сохранить правило");
    } finally {
      setBusy("");
    }
  }

  async function remove(id: string) {
    setBusy(id);
    setMessage("");
    try {
      await requestJson(`/api/message-rules/${id}`, { method: "DELETE" });
      await refresh();
      setMessage("Правило удалено.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось удалить правило");
    } finally {
      setBusy("");
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Avito Messenger"
        title="Правила автоответов"
        actions={
          <Button busy={busy === "create"} disabled={!draft.name.trim() || !draft.keywords.trim() || !draft.responseText.trim()} onClick={create}>
            <Plus className="h-4 w-4" />
            Добавить
          </Button>
        }
      />
      <div className="grid gap-4 p-4 xl:grid-cols-[380px_minmax(0,1fr)] xl:p-6">
        <section className="rounded-md border border-line bg-white p-5 shadow-panel">
          <h2 className="font-semibold">Новое правило</h2>
          <div className="mt-4 space-y-4">
            <TextField label="Название" value={draft.name} onChange={(name) => setDraft({ ...draft, name })} />
            <TextField label="Ключевые слова" value={draft.keywords} onChange={(keywords) => setDraft({ ...draft, keywords })} placeholder="размер, доставка, цена" />
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-moss">Ответ</span>
              <textarea
                className="min-h-[140px] w-full rounded-md border-line text-sm"
                value={draft.responseText}
                onChange={(event) => setDraft({ ...draft, responseText: event.target.value })}
                placeholder="Здравствуйте! Да, товар в наличии."
              />
            </label>
            <div className="grid gap-3 md:grid-cols-2">
              <NumberField label="Приоритет" value={draft.priority} onChange={(priority) => setDraft({ ...draft, priority })} />
              <NumberField label="Пауза, сек" value={draft.cooldownSeconds} onChange={(cooldownSeconds) => setDraft({ ...draft, cooldownSeconds })} />
            </div>
            <Toggle label="Один раз на чат" checked={draft.oncePerChat} onChange={(oncePerChat) => setDraft({ ...draft, oncePerChat })} />
            <Toggle label="Включено" checked={draft.active} onChange={(active) => setDraft({ ...draft, active })} />
          </div>
        </section>

        <section className="space-y-3">
          {message ? <p className="rounded-md border border-line bg-white p-3 text-sm font-semibold text-moss">{message}</p> : null}
          {rules.map((rule) => (
            <RuleCard key={rule.id} rule={rule} busy={busy === rule.id} onPatch={(payload) => patch(rule.id, payload)} onDelete={() => remove(rule.id)} />
          ))}
          {!rules.length ? <p className="rounded-md border border-line bg-white p-8 text-center text-sm text-moss">Правил пока нет.</p> : null}
        </section>
      </div>
    </>
  );
}

function RuleCard({
  rule,
  busy,
  onPatch,
  onDelete,
}: {
  rule: ClientMessageRule;
  busy: boolean;
  onPatch: (payload: Partial<RuleDraft>) => void;
  onDelete: () => void;
}) {
  const [draft, setDraft] = useState<RuleDraft>({
    name: rule.name,
    keywords: rule.keywords,
    responseText: rule.responseText,
    priority: rule.priority,
    cooldownSeconds: rule.cooldownSeconds,
    oncePerChat: rule.oncePerChat,
    active: rule.active,
  });
  return (
    <div className="rounded-md border border-line bg-white p-5 shadow-panel">
      <div className="grid gap-4 md:grid-cols-2">
        <TextField label="Название" value={draft.name} onChange={(name) => setDraft({ ...draft, name })} />
        <TextField label="Ключевые слова" value={draft.keywords} onChange={(keywords) => setDraft({ ...draft, keywords })} />
        <NumberField label="Приоритет" value={draft.priority} onChange={(priority) => setDraft({ ...draft, priority })} />
        <NumberField label="Пауза, сек" value={draft.cooldownSeconds} onChange={(cooldownSeconds) => setDraft({ ...draft, cooldownSeconds })} />
      </div>
      <label className="mt-4 block">
        <span className="mb-1 block text-xs font-semibold text-moss">Ответ</span>
        <textarea
          className="min-h-[110px] w-full rounded-md border-line text-sm"
          value={draft.responseText}
          onChange={(event) => setDraft({ ...draft, responseText: event.target.value })}
        />
      </label>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-4">
          <Toggle label="Один раз на чат" checked={draft.oncePerChat} onChange={(oncePerChat) => setDraft({ ...draft, oncePerChat })} />
          <Toggle label="Включено" checked={draft.active} onChange={(active) => setDraft({ ...draft, active })} />
        </div>
        <div className="flex gap-2">
          <Button tone="secondary" busy={busy} onClick={() => onPatch(draft)}>
            <Save className="h-4 w-4" />
            Сохранить
          </Button>
          <Button tone="danger" busy={busy} onClick={onDelete}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="inline-flex items-center gap-2 text-sm font-semibold text-moss">
      <input className="rounded border-line text-sea" type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      {label}
    </label>
  );
}

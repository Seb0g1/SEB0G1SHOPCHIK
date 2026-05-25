"use client";

import clsx from "clsx";
import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  actions,
}: {
  eyebrow?: string;
  title: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-line bg-white px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="min-w-0">
        {eyebrow ? <p className="text-xs font-semibold uppercase text-moss">{eyebrow}</p> : null}
        <h1 className="mt-1 truncate text-2xl font-semibold text-ink">{title}</h1>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function Button({
  children,
  tone = "primary",
  busy = false,
  type = "button",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: "primary" | "secondary" | "dark" | "danger";
  busy?: boolean;
}) {
  return (
    <button
      className={clsx(
        "inline-flex h-10 items-center justify-center gap-2 rounded-md px-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60",
        tone === "primary" && "bg-sea text-white hover:bg-teal-800",
        tone === "secondary" && "border border-line bg-white text-ink hover:bg-canvas",
        tone === "dark" && "bg-ink text-white hover:bg-black",
        tone === "danger" && "bg-signal text-white hover:bg-red-800",
        className,
      )}
      disabled={busy || props.disabled}
      type={type}
      {...props}
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      {children}
    </button>
  );
}

export function TextField({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-moss">{label}</span>
      <input
        className="h-10 w-full rounded-md border-line bg-white text-sm"
        placeholder={placeholder}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

export function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-moss">{label}</span>
      <input
        className="h-10 w-full rounded-md border-line bg-white text-sm"
        min={0}
        type="number"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

export function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-moss">{label}</span>
      <select
        className="h-10 w-full rounded-md border-line bg-white text-sm"
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

export function StatusPill({ status }: { status: string }) {
  const tone =
    status === "READY" || status === "SUBMITTED"
      ? "ok"
      : status === "ERROR" || status === "SUSPENDED"
        ? "bad"
        : status === "WARNING"
          ? "warn"
          : "neutral";
  return (
    <span
      className={clsx(
        "inline-flex h-7 items-center rounded px-2 text-xs font-semibold uppercase",
        tone === "ok" && "bg-emerald-50 text-emerald-700",
        tone === "warn" && "bg-amber-50 text-amber-700",
        tone === "bad" && "bg-red-50 text-red-700",
        tone === "neutral" && "bg-zinc-100 text-zinc-700",
      )}
    >
      {status}
    </span>
  );
}

export function EmptyState({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="flex min-h-[360px] flex-col items-center justify-center gap-4 rounded-md border border-dashed border-line bg-white p-8 text-center">
      <p className="max-w-md text-lg font-semibold text-ink">{title}</p>
      {action}
    </div>
  );
}

export function formatMoney(value: number) {
  return new Intl.NumberFormat("ru-RU").format(value);
}

export async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      ...(init?.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...(init?.headers ?? {}),
    },
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  if (!response.ok) throw new Error(payload.error || payload.message || "Request failed");
  return payload as T;
}

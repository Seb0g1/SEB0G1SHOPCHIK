"use client";

import { Download } from "lucide-react";
import { useMemo, useState } from "react";
import { Button, requestJson } from "@/components/ui-kit";

type ExcelCheckResponse = {
  errors: string[];
  warnings: string[];
  rowCount: number;
  imageOrigin: string;
};

export function ExcelDownloadButton({
  productIds,
  label = "Скачать Excel",
  compact = false,
}: {
  productIds?: string[];
  label?: string;
  compact?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const query = useMemo(() => {
    const ids = (productIds ?? []).filter(Boolean);
    return ids.length ? `?productIds=${encodeURIComponent(ids.join(","))}` : "";
  }, [productIds]);

  async function download() {
    setBusy(true);
    setMessage("");
    try {
      const check = await requestJson<ExcelCheckResponse>(`/api/avito/excel/check${query}`);
      if (check.errors.length) {
        setMessage(check.errors[0]);
        return;
      }

      const warning = check.warnings[0];
      setMessage(
        warning
          ? `${warning} В файле будет ${check.rowCount} строк объявлений.`
          : `Готово: ${check.rowCount} строк объявлений для Avito.`,
      );
      window.location.href = `/api/avito/excel/products.xlsx${query}`;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось подготовить Excel.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={compact ? "space-y-1" : "max-w-md space-y-2"}>
      <Button tone="secondary" busy={busy} onClick={download}>
        <Download className="h-4 w-4" />
        {label}
      </Button>
      {message ? <p className={compact ? "text-xs font-semibold text-moss" : "text-sm font-semibold text-moss"}>{message}</p> : null}
    </div>
  );
}

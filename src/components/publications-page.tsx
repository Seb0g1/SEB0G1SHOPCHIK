"use client";

import Link from "next/link";
import { describePublicationReportStatus } from "@/lib/publication-status";
import { PageHeader, StatusPill } from "@/components/ui-kit";

export type PublicationListItem = {
  id: string;
  productId: string | null;
  productTitle: string;
  status: string;
  reportStatus: string | null;
  submittedAt: string;
  errors: string[];
  warnings: string[];
};

export function PublicationsPage({ runs }: { runs: PublicationListItem[] }) {
  return (
    <>
      <PageHeader eyebrow="Avito" title="Публикации" />
      <div className="p-4 xl:p-6">
        <div className="overflow-hidden rounded-md border border-line bg-white shadow-panel">
          <div className="grid grid-cols-[1.3fr_.7fr_.8fr_1fr] gap-3 border-b border-line bg-canvas px-4 py-3 text-xs font-semibold uppercase text-moss max-lg:hidden">
            <span>Товар</span>
            <span>Статус</span>
            <span>Время</span>
            <span>Отчет</span>
          </div>
          <div className="divide-y divide-line">
            {runs.map((run) => (
              <Link
                key={run.id}
                className="grid gap-3 px-4 py-4 transition hover:bg-canvas lg:grid-cols-[1.3fr_.7fr_.8fr_1fr] lg:items-center"
                href={run.productId ? `/products/${run.productId}` : "/products"}
              >
                <p className="font-semibold">{run.productTitle}</p>
                <StatusPill status={run.status} />
                <p className="text-sm text-moss">{new Date(run.submittedAt).toLocaleString("ru-RU")}</p>
                <div className="text-sm text-moss">
                  <p>{describePublicationReportStatus(run.reportStatus)}</p>
                  {[...run.errors, ...run.warnings].slice(0, 2).map((item) => (
                    <p key={item} className="mt-1 text-red-700">
                      {item}
                    </p>
                  ))}
                </div>
              </Link>
            ))}
            {!runs.length ? <p className="p-8 text-center text-sm text-moss">Публикаций пока нет.</p> : null}
          </div>
        </div>
      </div>
    </>
  );
}

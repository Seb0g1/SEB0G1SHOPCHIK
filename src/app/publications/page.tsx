import { AppShell } from "@/components/app-shell";
import { PublicationsPage, type PublicationListItem } from "@/components/publications-page";
import { prisma } from "@/lib/prisma";
import { parseJsonList } from "@/lib/serializers";

export const dynamic = "force-dynamic";

export default async function PublicationsRoute() {
  const runs = await prisma.publicationRun.findMany({
    orderBy: { submittedAt: "desc" },
    take: 80,
    include: { product: { select: { title: true } } },
  });

  const items: PublicationListItem[] = runs.map((run) => ({
    id: run.id,
    productId: run.productId,
    productTitle: run.product?.title ?? "Товар удален",
    status: run.status,
    reportStatus: run.reportStatus,
    submittedAt: run.submittedAt.toISOString(),
    errors: parseJsonList(run.errorsJson),
    warnings: parseJsonList(run.warningsJson),
  }));

  return (
    <AppShell>
      <PublicationsPage runs={items} />
    </AppShell>
  );
}

import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { OrderDetailPage } from "@/components/order-detail-page";
import { getOrder } from "@/lib/orders";
import { listSuppliers } from "@/lib/suppliers";

export const dynamic = "force-dynamic";

export default async function OrderRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [order, suppliers] = await Promise.all([getOrder(id), listSuppliers({ includeInactive: true })]);
  if (!order) notFound();

  return (
    <AppShell>
      <OrderDetailPage initialOrder={order} suppliers={suppliers} />
    </AppShell>
  );
}

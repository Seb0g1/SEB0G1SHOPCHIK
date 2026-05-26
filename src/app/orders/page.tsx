import { AppShell } from "@/components/app-shell";
import { OrdersPage } from "@/components/orders-page";
import { listOrders } from "@/lib/orders";

export const dynamic = "force-dynamic";

export default async function OrdersRoute() {
  const orders = await listOrders();
  return (
    <AppShell>
      <OrdersPage initialOrders={orders} />
    </AppShell>
  );
}

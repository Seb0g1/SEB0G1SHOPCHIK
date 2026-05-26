import { AppShell } from "@/components/app-shell";
import { SuppliersPage } from "@/components/suppliers-page";
import { listSuppliers } from "@/lib/suppliers";

export const dynamic = "force-dynamic";

export default async function SuppliersRoute() {
  const suppliers = await listSuppliers({ includeInactive: true });
  return (
    <AppShell>
      <SuppliersPage initialSuppliers={suppliers} />
    </AppShell>
  );
}

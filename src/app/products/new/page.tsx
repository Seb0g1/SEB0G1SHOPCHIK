import { AppShell } from "@/components/app-shell";
import { ProductWizard } from "@/components/product-wizard";

export const dynamic = "force-dynamic";

export default function NewProductRoute() {
  return (
    <AppShell>
      <ProductWizard />
    </AppShell>
  );
}

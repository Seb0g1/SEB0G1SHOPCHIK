import { AppShell } from "@/components/app-shell";
import { ProductsPage } from "@/components/products-page";
import { listProducts } from "@/lib/products";

export const dynamic = "force-dynamic";

export default async function ProductsRoute() {
  const products = await listProducts();
  return (
    <AppShell>
      <ProductsPage products={products} />
    </AppShell>
  );
}

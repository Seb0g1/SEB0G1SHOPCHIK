import { Dashboard } from "@/components/dashboard";
import { listProducts } from "@/lib/products";
import { getAvitoSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [products, settings] = await Promise.all([listProducts(), getAvitoSettings()]);
  return <Dashboard initialProducts={products} initialSettings={settings} />;
}

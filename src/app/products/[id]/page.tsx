import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ProductEditor } from "@/components/product-editor";
import { getProduct } from "@/lib/products";

export const dynamic = "force-dynamic";

export default async function ProductRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await getProduct(id);
  if (!product) notFound();

  return (
    <AppShell>
      <ProductEditor initialProduct={product} />
    </AppShell>
  );
}

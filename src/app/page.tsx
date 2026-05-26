import { redirect } from "next/navigation";

export default async function HomePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const code = typeof params.code === "string" ? params.code : "";
  const error = typeof params.error === "string" ? params.error : "";
  if (code || error) {
    const query = new URLSearchParams();
    if (code) query.set("code", code);
    if (error) query.set("error", error);
    redirect(`/api/avito/oauth/callback?${query.toString()}`);
  }
  redirect("/products");
}

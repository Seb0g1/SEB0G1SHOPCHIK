import { AppShell } from "@/components/app-shell";
import { ReviewsPage } from "@/components/reviews-page";
import { listReviews } from "@/lib/reviews";

export const dynamic = "force-dynamic";

export default async function ReviewsRoute() {
  const reviews = await listReviews();
  return (
    <AppShell>
      <ReviewsPage initialReviews={reviews} />
    </AppShell>
  );
}

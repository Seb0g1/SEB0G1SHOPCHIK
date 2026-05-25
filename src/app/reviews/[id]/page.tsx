import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ReviewDetailPage } from "@/components/review-detail-page";
import { getReviewById } from "@/lib/reviews";

export const dynamic = "force-dynamic";

export default async function ReviewDetailRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const review = await getReviewById(id);
  if (!review) notFound();

  return (
    <AppShell>
      <ReviewDetailPage initialReview={review} />
    </AppShell>
  );
}

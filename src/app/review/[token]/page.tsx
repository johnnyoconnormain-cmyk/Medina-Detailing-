import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/db/client";
import { eq } from "drizzle-orm";
import { reviews, customers, businesses, jobs } from "@/db/schema";
import { ReviewForm } from "./ReviewForm";

export const metadata: Metadata = { title: "How did we do?", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function ReviewPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const [row] = await db.select({ review: reviews, customer: customers, business: businesses })
    .from(reviews)
    .innerJoin(customers, eq(reviews.customerId, customers.id))
    .innerJoin(businesses, eq(reviews.businessId, businesses.id))
    .where(eq(reviews.publicToken, token)).limit(1);
  if (!row) notFound();

  const job = row.review.jobId
    ? (await db.select().from(jobs).where(eq(jobs.id, row.review.jobId)).limit(1))[0]
    : undefined;

  return (
    <main className="mx-auto w-full max-w-md px-4 py-12 sm:py-20">
      <div className="text-center">
        <span className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded bg-moss-600 text-base font-bold text-white">
          {row.business.name.charAt(0)}
        </span>
        <h1 className="text-2xl font-semibold tracking-tight">How did we do?</h1>
        <p className="mt-2 text-sm text-muted">
          {job ? `${row.business.name} finished your ${job.title.toLowerCase()}.` : `${row.business.name} would love your feedback.`}
          {" "}It takes ten seconds.
        </p>
      </div>

      <ReviewForm
        token={token}
        businessName={row.business.name}
        alreadyRated={row.review.rating}
      />
    </main>
  );
}

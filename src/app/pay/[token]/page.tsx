import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/db/client";
import { eq } from "drizzle-orm";
import { invoices, customers, businesses, jobs, reviews } from "@/db/schema";
import { fmtMoney } from "@/lib/money";
import { PayPanel } from "./PayPanel";
import { getPaymentProvider } from "@/lib/adapters/payments";

export const metadata: Metadata = { title: "Pay invoice", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function PayPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const [row] = await db.select({ invoice: invoices, customer: customers, business: businesses })
    .from(invoices)
    .innerJoin(customers, eq(invoices.customerId, customers.id))
    .innerJoin(businesses, eq(invoices.businessId, businesses.id))
    .where(eq(invoices.publicToken, token)).limit(1);
  if (!row) notFound();

  const { invoice, customer, business } = row;
  const job = invoice.jobId
    ? (await db.select().from(jobs).where(eq(jobs.id, invoice.jobId)).limit(1))[0]
    : undefined;
  const review = invoice.jobId
    ? (await db.select().from(reviews).where(eq(reviews.jobId, invoice.jobId)).limit(1))[0]
    : undefined;

  const due = invoice.totalCents - invoice.amountPaidCents;
  const provider = getPaymentProvider();

  return (
    <main className="mx-auto w-full max-w-md px-4 py-10 sm:py-16">
      <div className="mb-7 flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded bg-moss-600 text-sm font-bold text-white">
          {business.name.charAt(0)}
        </span>
        <div>
          <p className="text-sm font-semibold leading-tight">{business.name}</p>
          {business.phone && <p className="tnum text-xs text-muted">{business.phone}</p>}
        </div>
      </div>

      <p className="label-xs">Invoice #{invoice.number}</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">
        {job ? `${job.title} is complete` : "Your invoice"}
      </h1>
      <p className="mt-1.5 text-sm text-muted">
        Thanks, {customer.name.split(" ")[0]}. Here&apos;s what&apos;s due.
      </p>

      <div className="card mt-6 p-5">
        <dl className="space-y-1.5 text-sm">
          <div className="flex justify-between"><dt className="text-muted">Subtotal</dt><dd className="tnum">{fmtMoney(invoice.subtotalCents)}</dd></div>
          {invoice.taxCents > 0 && (
            <div className="flex justify-between"><dt className="text-muted">Tax</dt><dd className="tnum">{fmtMoney(invoice.taxCents)}</dd></div>
          )}
          {invoice.amountPaidCents > 0 && (
            <div className="flex justify-between"><dt className="text-muted">Already paid</dt><dd className="tnum">−{fmtMoney(invoice.amountPaidCents)}</dd></div>
          )}
          <div className="flex items-baseline justify-between border-t pt-2.5" style={{ borderColor: "rgb(var(--border))" }}>
            <dt className="text-sm font-semibold">Total due</dt>
            <dd className="tnum text-3xl font-semibold tracking-tight">{fmtMoney(due)}</dd>
          </div>
        </dl>
      </div>

      <PayPanel
        token={token}
        alreadyPaid={invoice.status === "paid"}
        dueCents={due}
        businessName={business.name}
        providerLive={provider.live}
        reviewToken={review?.publicToken ?? null}
      />

      <footer className="mt-10 border-t pt-4 text-center text-2xs text-faint" style={{ borderColor: "rgb(var(--border))" }}>
        {invoice.dueAt && invoice.status !== "paid" && (
          <p>Due {invoice.dueAt.toLocaleDateString("en-US", { month: "long", day: "numeric" })}</p>
        )}
        <p className="mt-1">{business.name} · Powered by YardOps</p>
      </footer>
    </main>
  );
}

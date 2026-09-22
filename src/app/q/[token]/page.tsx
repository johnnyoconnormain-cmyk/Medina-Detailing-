import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/db/client";
import { eq, asc } from "drizzle-orm";
import { quotes, quoteItems, customers, businesses, jobs } from "@/db/schema";
import { markQuoteViewed } from "@/actions/quotes";
import { fmtMoney } from "@/lib/money";
import { QuoteResponse } from "./QuoteResponse";

export const metadata: Metadata = { title: "Your quote", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function PublicQuote({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const [row] = await db.select({ quote: quotes, customer: customers, business: businesses })
    .from(quotes)
    .innerJoin(customers, eq(quotes.customerId, customers.id))
    .innerJoin(businesses, eq(quotes.businessId, businesses.id))
    .where(eq(quotes.publicToken, token)).limit(1);
  if (!row) notFound();

  const { quote, customer, business } = row;
  const [items, linkedJob] = await Promise.all([
    db.select().from(quoteItems).where(eq(quoteItems.quoteId, quote.id)).orderBy(asc(quoteItems.sortOrder)),
    db.select().from(jobs).where(eq(jobs.quoteId, quote.id)).limit(1),
  ]);

  // Opening the page is the "viewed" signal the owner sees on their side.
  await markQuoteViewed(token);

  const expired = quote.validUntil ? quote.validUntil.getTime() < Date.now() : false;

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:py-14">
      <header className="mb-8">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded bg-moss-600 text-sm font-bold text-white">
            {business.name.charAt(0)}
          </span>
          <div>
            <p className="text-sm font-semibold leading-tight">{business.name}</p>
            {business.phone && <p className="tnum text-xs text-muted">{business.phone}</p>}
          </div>
        </div>
      </header>

      <p className="label-xs">Quote #{quote.number}</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{quote.title}</h1>
      <p className="mt-1.5 text-sm text-muted">
        Prepared for {customer.name}
        {customer.addressLine ? ` · ${customer.addressLine}` : ""}
      </p>

      <section className="card mt-6 overflow-hidden">
        <ul className="divide-y" style={{ borderColor: "rgb(var(--border))" }}>
          {items.map((it) => (
            <li key={it.id} className="flex items-baseline justify-between gap-4 px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">{it.label}</p>
                {it.quantity !== 1 && (
                  <p className="tnum text-xs text-muted">
                    {it.quantity} × {fmtMoney(it.unitPriceCents)}
                  </p>
                )}
              </div>
              <p className="tnum flex-none text-sm font-semibold">{fmtMoney(it.totalCents)}</p>
            </li>
          ))}
        </ul>

        <div className="border-t px-4 py-3" style={{ borderColor: "rgb(var(--border))", background: "rgb(var(--surface-2))" }}>
          {quote.taxCents > 0 && (
            <>
              <Row label="Subtotal" value={fmtMoney(quote.subtotalCents)} />
              <Row label="Tax" value={fmtMoney(quote.taxCents)} />
            </>
          )}
          <div className="mt-1.5 flex items-baseline justify-between border-t pt-2.5" style={{ borderColor: "rgb(var(--border))" }}>
            <span className="text-sm font-semibold">Total</span>
            <span className="tnum text-2xl font-semibold tracking-tight">{fmtMoney(quote.totalCents)}</span>
          </div>
        </div>
      </section>

      {quote.notes && (
        <p className="mt-4 rounded border px-4 py-3 text-xs leading-relaxed text-muted"
           style={{ borderColor: "rgb(var(--border))" }}>
          {quote.notes}
        </p>
      )}

      <QuoteResponse
        token={token}
        status={quote.status}
        expired={expired}
        businessName={business.name}
        businessPhone={business.phone}
        hasJob={Boolean(linkedJob[0])}
      />

      <footer className="mt-10 border-t pt-4 text-center text-2xs text-faint" style={{ borderColor: "rgb(var(--border))" }}>
        {quote.validUntil && !expired && (
          <p>Valid through {quote.validUntil.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>
        )}
        <p className="mt-1">Sent by {business.name} · Powered by YardOps</p>
      </footer>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 text-xs">
      <span className="text-muted">{label}</span>
      <span className="tnum">{value}</span>
    </div>
  );
}

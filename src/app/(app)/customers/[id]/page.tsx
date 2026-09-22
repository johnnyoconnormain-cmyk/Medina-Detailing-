import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCtx } from "@/lib/tenant";
import { db } from "@/db/client";
import { and, eq, desc, sql } from "drizzle-orm";
import { customers, jobs, quotes, invoices, messages, jobPhotos, reviews } from "@/db/schema";
import { TopBar } from "@/components/shell/TopBar";
import { Card, SectionHeader, StatusChip, Money, Chip, EmptyState } from "@/components/ui/primitives";
import { fmtMoney } from "@/lib/money";

export const metadata: Metadata = { title: "Customer" };
export const dynamic = "force-dynamic";

export default async function CustomerDetail({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireCtx();
  const { id } = await params;

  const [customer] = await db.select().from(customers)
    .where(and(eq(customers.id, id), eq(customers.businessId, ctx.businessId))).limit(1);
  if (!customer) notFound();

  const [jobRows, quoteRows, invoiceRows, thread, photos, reviewRows] = await Promise.all([
    db.select().from(jobs).where(eq(jobs.customerId, id)).orderBy(desc(jobs.scheduledStart)).limit(40),
    db.select().from(quotes).where(eq(quotes.customerId, id)).orderBy(desc(quotes.createdAt)).limit(20),
    db.select().from(invoices).where(eq(invoices.customerId, id)).orderBy(desc(invoices.createdAt)).limit(20),
    db.select().from(messages).where(eq(messages.customerId, id)).orderBy(desc(messages.createdAt)).limit(15),
    db.select({ url: jobPhotos.url, kind: jobPhotos.kind, id: jobPhotos.id })
      .from(jobPhotos).innerJoin(jobs, eq(jobPhotos.jobId, jobs.id))
      .where(eq(jobs.customerId, id)).limit(12),
    db.select().from(reviews).where(eq(reviews.customerId, id)).orderBy(desc(reviews.respondedAt)).limit(5),
  ]);

  const lifetime = invoiceRows.reduce((n, i) => n + i.amountPaidCents, 0);
  const open = invoiceRows.reduce((n, i) => n + (i.status === "paid" ? 0 : i.totalCents - i.amountPaidCents), 0);
  const completed = jobRows.filter((j) => j.status === "complete").length;
  const avg = completed > 0 ? Math.round(jobRows.filter((j) => j.status === "complete").reduce((n, j) => n + j.valueCents, 0) / completed) : 0;

  return (
    <>
      <TopBar title={customer.name}
        subtitle={[customer.addressLine, customer.city].filter(Boolean).join(", ")}
        right={<Link href={`/quotes/new?customerId=${customer.id}`} className="btn btn-secondary !px-2.5 !py-1.5 text-xs">New quote</Link>} />

      <main className="mx-auto w-full max-w-[1100px] flex-1 space-y-3 p-3 sm:p-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Lifetime" value={fmtMoney(lifetime)} />
          <Stat label="Jobs done" value={String(completed)} />
          <Stat label="Average job" value={avg ? fmtMoney(avg) : "—"} />
          <Stat label="Open balance" value={fmtMoney(open)} tone={open > 0 ? "warn" : undefined} />
        </div>

        <div className="grid gap-3 lg:grid-cols-3">
          <div className="space-y-3 lg:col-span-2">
            <Card className="overflow-hidden">
              <SectionHeader title="Jobs" count={jobRows.length} />
              {jobRows.length === 0 ? <EmptyState title="No jobs yet" /> : (
                <ul className="divide-y" style={{ borderColor: "rgb(var(--border))" }}>
                  {jobRows.slice(0, 12).map((j) => (
                    <li key={j.id}>
                      <Link href={`/jobs/${j.id}`} className="row-link flex items-center gap-3 px-4 py-2.5">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm">{j.title}</span>
                          <span className="tnum block text-2xs text-faint">
                            {j.scheduledStart?.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) ?? "unscheduled"}
                          </span>
                        </span>
                        <StatusChip status={j.status} />
                        <Money cents={j.valueCents} className="text-sm font-medium" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            {quoteRows.length > 0 && (
              <Card className="overflow-hidden">
                <SectionHeader title="Quotes" count={quoteRows.length} />
                <ul className="divide-y" style={{ borderColor: "rgb(var(--border))" }}>
                  {quoteRows.slice(0, 8).map((q) => (
                    <li key={q.id}>
                      <Link href={`/quotes/${q.id}`} className="row-link flex items-center gap-3 px-4 py-2.5">
                        <span className="flex-1 truncate text-sm">#{q.number} · {q.title}</span>
                        <StatusChip status={q.status} />
                        <Money cents={q.totalCents} className="text-sm font-medium" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            {photos.length > 0 && (
              <Card>
                <SectionHeader title="Job photos" count={photos.length} />
                <div className="grid grid-cols-3 gap-2 px-4 pb-4 sm:grid-cols-4">
                  {photos.map((p) => (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img key={p.id} src={p.url} alt={p.kind} className="aspect-[4/3] w-full rounded object-cover" />
                  ))}
                </div>
              </Card>
            )}
          </div>

          <div className="space-y-3">
            <Card>
              <SectionHeader title="Contact" />
              <dl className="space-y-2 px-4 pb-4 text-xs">
                {customer.phone && <Row label="Phone" value={<a href={`tel:${customer.phone}`} className="tnum text-moss-600 hover:underline dark:text-moss-400">{customer.phone}</a>} />}
                {customer.email && <Row label="Email" value={<a href={`mailto:${customer.email}`} className="text-moss-600 hover:underline dark:text-moss-400">{customer.email}</a>} />}
                {customer.addressLine && <Row label="Address" value={<span className="text-right">{customer.addressLine}<br />{customer.city}, {customer.state} {customer.postalCode}</span>} />}
                <Row label="Customer since" value={<span className="tnum">{customer.createdAt.toLocaleDateString("en-US", { month: "short", year: "numeric" })}</span>} />
              </dl>
              {customer.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 px-4 pb-4">
                  {customer.tags.map((t) => <Chip key={t} tone="info">{t}</Chip>)}
                </div>
              )}
            </Card>

            {reviewRows.some((r) => r.rating) && (
              <Card>
                <SectionHeader title="Reviews" />
                <ul className="space-y-2 px-4 pb-4">
                  {reviewRows.filter((r) => r.rating).map((r) => (
                    <li key={r.id} className="text-xs">
                      <p className="text-clay-500">{"★".repeat(r.rating!)}{"☆".repeat(5 - r.rating!)}</p>
                      {r.privateFeedback && <p className="mt-0.5 text-muted">{r.privateFeedback}</p>}
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            <Card>
              <SectionHeader title="Communication" count={thread.length} />
              {thread.length === 0 ? <EmptyState title="No messages yet" /> : (
                <ul className="scroll-thin max-h-80 space-y-2 overflow-y-auto px-4 pb-4">
                  {thread.map((m) => (
                    <li key={m.id} className="rounded bg-[rgb(var(--surface-2))] p-2 text-2xs leading-relaxed">
                      <p className="mb-0.5 flex items-center gap-1.5 text-faint">
                        <span className="font-semibold uppercase">{m.direction === "outbound" ? "Sent" : "Received"}</span>
                        {m.automated && <Chip tone="neutral">auto</Chip>}
                        <span className="ml-auto">{m.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                      </p>
                      {m.body}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </div>
      </main>
    </>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "warn" }) {
  return (
    <div className="card px-3.5 py-3">
      <p className="label-xs">{label}</p>
      <p className={`tnum mt-1 text-lg font-semibold tracking-tight ${tone === "warn" ? "text-clay-600 dark:text-clay-400" : ""}`}>{value}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="flex justify-between gap-3"><dt className="flex-none text-faint">{label}</dt><dd className="text-right">{value}</dd></div>;
}

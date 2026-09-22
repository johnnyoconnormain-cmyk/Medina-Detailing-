import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCtx } from "@/lib/tenant";
import { db } from "@/db/client";
import { and, eq, asc, desc } from "drizzle-orm";
import { quotes, quoteItems, customers, jobs, scheduledTasks, messages } from "@/db/schema";
import { TopBar } from "@/components/shell/TopBar";
import { Card, SectionHeader, StatusChip, Money, Chip } from "@/components/ui/primitives";
import { fmtMoney } from "@/lib/money";
import { CopyLink } from "@/components/ui/CopyLink";

export const metadata: Metadata = { title: "Quote" };
export const dynamic = "force-dynamic";

export default async function QuoteDetail({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireCtx();
  const { id } = await params;

  const [row] = await db.select({ quote: quotes, customer: customers })
    .from(quotes).innerJoin(customers, eq(quotes.customerId, customers.id))
    .where(and(eq(quotes.id, id), eq(quotes.businessId, ctx.businessId))).limit(1);
  if (!row) notFound();

  const { quote, customer } = row;
  const [items, linkedJob, pending, thread] = await Promise.all([
    db.select().from(quoteItems).where(eq(quoteItems.quoteId, quote.id)).orderBy(asc(quoteItems.sortOrder)),
    db.select().from(jobs).where(eq(jobs.quoteId, quote.id)).limit(1),
    db.select().from(scheduledTasks)
      .where(and(eq(scheduledTasks.entityType, "quote"), eq(scheduledTasks.entityId, quote.id), eq(scheduledTasks.status, "pending"))),
    db.select().from(messages).where(eq(messages.quoteId, quote.id)).orderBy(desc(messages.createdAt)).limit(8),
  ]);

  return (
    <>
      <TopBar title={`Quote #${quote.number}`} subtitle={`${customer.name} · ${quote.title}`} />

      <main className="mx-auto w-full max-w-[1000px] flex-1 space-y-3 p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-2">
          <StatusChip status={quote.status} />
          {quote.viewedAt && <Chip tone="info">Opened {quote.viewedAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</Chip>}
          {pending.length > 0 && <Chip tone="warning">{pending.length} follow-up queued</Chip>}
          {linkedJob[0] && (
            <Link href={`/jobs/${linkedJob[0].id}`} className="text-xs font-semibold text-moss-600 hover:underline dark:text-moss-400">
              View job #{linkedJob[0].number} →
            </Link>
          )}
        </div>

        <div className="grid gap-3 lg:grid-cols-3">
          <Card className="overflow-hidden lg:col-span-2">
            <SectionHeader title="Line items" />
            <table className="w-full text-sm">
              <thead>
                <tr className="border-y text-left" style={{ borderColor: "rgb(var(--border))" }}>
                  <th className="label-xs px-4 py-1.5 font-semibold">Description</th>
                  <th className="label-xs px-2 py-1.5 text-right">Qty</th>
                  <th className="label-xs px-2 py-1.5 text-right">Rate</th>
                  <th className="label-xs px-4 py-1.5 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: "rgb(var(--border))" }}>
                {items.map((it) => (
                  <tr key={it.id}>
                    <td className="px-4 py-2">
                      <span className="font-medium">{it.label}</span>
                      <span className="ml-2 text-2xs capitalize text-faint">{it.kind}</span>
                    </td>
                    <td className="tnum px-2 py-2 text-right text-xs">{it.quantity}</td>
                    <td className="tnum px-2 py-2 text-right text-xs">{fmtMoney(it.unitPriceCents)}</td>
                    <td className="tnum px-4 py-2 text-right font-medium">{fmtMoney(it.totalCents)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t" style={{ borderColor: "rgb(var(--border))" }}>
                <tr><td colSpan={3} className="px-4 py-1.5 text-right text-xs text-muted">Subtotal</td>
                    <td className="tnum px-4 py-1.5 text-right text-xs">{fmtMoney(quote.subtotalCents)}</td></tr>
                {quote.taxCents > 0 && (
                  <tr><td colSpan={3} className="px-4 py-1.5 text-right text-xs text-muted">Tax</td>
                      <td className="tnum px-4 py-1.5 text-right text-xs">{fmtMoney(quote.taxCents)}</td></tr>
                )}
                <tr><td colSpan={3} className="px-4 pb-3 pt-1.5 text-right text-sm font-semibold">Total</td>
                    <td className="tnum px-4 pb-3 pt-1.5 text-right text-lg font-semibold">{fmtMoney(quote.totalCents)}</td></tr>
              </tfoot>
            </table>
            {quote.notes && <p className="border-t px-4 py-3 text-xs text-muted" style={{ borderColor: "rgb(var(--border))" }}>{quote.notes}</p>}
          </Card>

          <div className="space-y-3">
            <Card>
              <SectionHeader title="Customer link" />
              <div className="px-4 pb-4">
                <p className="mb-2 text-xs text-muted">
                  This is what {customer.name.split(" ")[0]} sees. Anyone with the link can view and accept it.
                </p>
                <CopyLink path={`/q/${quote.publicToken}`} />
                <Link href={`/q/${quote.publicToken}`} target="_blank"
                      className="btn btn-secondary mt-2 w-full text-xs">Preview customer view</Link>
              </div>
            </Card>

            <Card>
              <SectionHeader title="Timeline" />
              <ul className="space-y-2 px-4 pb-4 text-xs">
                <TimelineRow label="Created" at={quote.createdAt} />
                <TimelineRow label="Sent" at={quote.sentAt} />
                <TimelineRow label="Opened by customer" at={quote.viewedAt} />
                <TimelineRow label="Responded" at={quote.respondedAt} />
                <TimelineRow label="Valid until" at={quote.validUntil} />
              </ul>
            </Card>

            {thread.length > 0 && (
              <Card>
                <SectionHeader title="Messages" count={thread.length} />
                <ul className="space-y-2 px-4 pb-4">
                  {thread.map((m) => (
                    <li key={m.id} className="rounded bg-[rgb(var(--surface-2))] p-2 text-2xs leading-relaxed">
                      <p className="mb-0.5 flex gap-2 text-faint">
                        {m.automated && <Chip tone="neutral">auto</Chip>}
                        <span className="ml-auto">{m.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                      </p>
                      {m.body}
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </div>
        </div>
      </main>
    </>
  );
}

function TimelineRow({ label, at }: { label: string; at: Date | null }) {
  return (
    <li className="flex justify-between gap-3">
      <span className="text-muted">{label}</span>
      <span className={at ? "tnum font-medium" : "text-faint"}>
        {at ? at.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—"}
      </span>
    </li>
  );
}

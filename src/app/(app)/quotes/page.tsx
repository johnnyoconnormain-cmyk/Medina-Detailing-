import type { Metadata } from "next";
import Link from "next/link";
import { requireCtx } from "@/lib/tenant";
import { db } from "@/db/client";
import { and, eq, desc, inArray, lt, sql } from "drizzle-orm";
import { quotes, customers, scheduledTasks } from "@/db/schema";
import { TopBar } from "@/components/shell/TopBar";
import { StatusChip, Money, EmptyState, Chip } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Quotes" };
export const dynamic = "force-dynamic";

const TABS = [
  { key: "open", label: "Awaiting response" },
  { key: "stale", label: "Needs follow-up" },
  { key: "accepted", label: "Accepted" },
  { key: "declined", label: "Declined" },
  { key: "all", label: "All" },
];

export default async function QuotesPage({ searchParams }: {
  searchParams: Promise<{ status?: string; filter?: string }>;
}) {
  const ctx = await requireCtx();
  const sp = await searchParams;
  const tab = sp.filter === "stale" ? "stale" : (sp.status ?? "open");

  const base = eq(quotes.businessId, ctx.businessId);
  const where =
    tab === "open" ? and(base, inArray(quotes.status, ["sent", "viewed"]))
    : tab === "stale" ? and(base, inArray(quotes.status, ["sent", "viewed"]), lt(quotes.sentAt, new Date(Date.now() - 3 * 864e5)))
    : tab === "accepted" ? and(base, eq(quotes.status, "accepted"))
    : tab === "declined" ? and(base, eq(quotes.status, "declined"))
    : base;

  const rows = await db.select({
    id: quotes.id, number: quotes.number, title: quotes.title, status: quotes.status,
    totalCents: quotes.totalCents, sentAt: quotes.sentAt, viewedAt: quotes.viewedAt,
    customerName: customers.name,
    pendingFollowUps: sql<number>`(
      select count(*) from scheduled_tasks st
      where st.entity_type = 'quote' and st.entity_id = quotes.id and st.status = 'pending'
    )::int`,
  }).from(quotes)
    .innerJoin(customers, eq(quotes.customerId, customers.id))
    .where(where).orderBy(desc(quotes.createdAt)).limit(200);

  const total = rows.reduce((n, r) => n + r.totalCents, 0);

  return (
    <>
      <TopBar title="Quotes" subtitle={`${rows.length} quote${rows.length === 1 ? "" : "s"} · $${Math.round(total / 100).toLocaleString("en-US")}`}
              right={<Link href="/quotes/new" className="btn btn-secondary !px-2.5 !py-1.5 text-xs">New quote</Link>} />

      <div className="border-b px-4 py-2" style={{ borderColor: "rgb(var(--border))" }}>
        <div className="scroll-thin flex gap-1 overflow-x-auto">
          {TABS.map((t) => (
            <Link key={t.key} href={t.key === "stale" ? "/quotes?filter=stale" : `/quotes?status=${t.key}`}
              className={`whitespace-nowrap rounded px-2.5 py-1 text-xs font-medium ${
                t.key === tab ? "bg-bark-900 text-white dark:bg-bark-100 dark:text-bark-950" : "text-muted hover:bg-[rgb(var(--surface-2))]"
              }`}>{t.label}</Link>
          ))}
        </div>
      </div>

      <main className="mx-auto w-full max-w-[1400px] flex-1 p-3 sm:p-4">
        {rows.length === 0 ? (
          <div className="card"><EmptyState title="No quotes here"
            action={<Link href="/quotes/new" className="btn btn-primary text-xs">Build a quote</Link>} /></div>
        ) : (
          <ul className="card divide-y overflow-hidden" style={{ borderColor: "rgb(var(--border))" }}>
            {rows.map((q) => (
              <li key={q.id}>
                <Link href={`/quotes/${q.id}`} className="row-link flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3">
                  <span className="tnum w-14 flex-none text-xs text-faint">#{q.number}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{q.customerName}</span>
                    <span className="block truncate text-xs text-muted">{q.title}</span>
                  </span>
                  {q.pendingFollowUps > 0 && <Chip tone="info">follow-up queued</Chip>}
                  {q.viewedAt && q.status === "viewed" && <Chip tone="warning">opened</Chip>}
                  <StatusChip status={q.status} />
                  <Money cents={q.totalCents} className="w-20 flex-none text-right text-sm font-semibold" />
                  <span className="w-16 flex-none text-right text-2xs text-faint">
                    {q.sentAt ? `${Math.round((Date.now() - q.sentAt.getTime()) / 864e5)}d ago` : "draft"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}

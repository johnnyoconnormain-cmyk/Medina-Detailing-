import type { Metadata } from "next";
import Link from "next/link";
import { requireCtx } from "@/lib/tenant";
import { db } from "@/db/client";
import { and, eq, desc, inArray, sql } from "drizzle-orm";
import { invoices, customers } from "@/db/schema";
import { TopBar } from "@/components/shell/TopBar";
import { StatusChip, Money, EmptyState, Chip } from "@/components/ui/primitives";
import { fmtMoney } from "@/lib/money";

export const metadata: Metadata = { title: "Invoices" };
export const dynamic = "force-dynamic";

export default async function InvoicesPage({ searchParams }: {
  searchParams: Promise<{ filter?: string; status?: string }>;
}) {
  const ctx = await requireCtx();
  const sp = await searchParams;
  const tab = sp.filter === "unpaid" ? "unpaid" : (sp.status ?? "unpaid");

  const base = eq(invoices.businessId, ctx.businessId);
  const where = tab === "paid" ? and(base, eq(invoices.status, "paid"))
    : tab === "all" ? base
    : and(base, inArray(invoices.status, ["sent", "overdue", "draft"]));

  const rows = await db.select({
    id: invoices.id, number: invoices.number, status: invoices.status,
    totalCents: invoices.totalCents, amountPaidCents: invoices.amountPaidCents,
    dueAt: invoices.dueAt, sentAt: invoices.sentAt, paidAt: invoices.paidAt,
    customerName: customers.name,
  }).from(invoices)
    .innerJoin(customers, eq(invoices.customerId, customers.id))
    .where(where).orderBy(desc(invoices.createdAt)).limit(200);

  const outstanding = rows.reduce((n, r) => n + (r.status === "paid" ? 0 : r.totalCents - r.amountPaidCents), 0);
  const tabs = [{ k: "unpaid", l: "Outstanding" }, { k: "paid", l: "Paid" }, { k: "all", l: "All" }];

  return (
    <>
      <TopBar title="Invoices"
              subtitle={outstanding > 0 ? `${fmtMoney(outstanding)} outstanding` : "Nothing outstanding"} />

      <div className="border-b px-4 py-2" style={{ borderColor: "rgb(var(--border))" }}>
        <div className="flex gap-1">
          {tabs.map((t) => (
            <Link key={t.k} href={`/invoices?status=${t.k}`}
              className={`rounded px-2.5 py-1 text-xs font-medium ${
                t.k === tab ? "bg-bark-900 text-white dark:bg-bark-100 dark:text-bark-950" : "text-muted hover:bg-[rgb(var(--surface-2))]"
              }`}>{t.l}</Link>
          ))}
        </div>
      </div>

      <main className="mx-auto w-full max-w-[1400px] flex-1 p-3 sm:p-4">
        {rows.length === 0 ? (
          <div className="card"><EmptyState title="No invoices here"
            hint="Completing a job creates its invoice automatically." /></div>
        ) : (
          <ul className="card divide-y overflow-hidden" style={{ borderColor: "rgb(var(--border))" }}>
            {rows.map((inv) => {
              const due = inv.totalCents - inv.amountPaidCents;
              const overdue = inv.status !== "paid" && inv.dueAt && inv.dueAt.getTime() < Date.now();
              return (
                <li key={inv.id}>
                  <Link href={`/invoices/${inv.id}`} className="row-link flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3">
                    <span className="tnum w-14 flex-none text-xs text-faint">#{inv.number}</span>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{inv.customerName}</span>
                    {overdue && <Chip tone="danger">overdue</Chip>}
                    <StatusChip status={inv.status} />
                    <span className="w-24 flex-none text-right">
                      <Money cents={inv.totalCents} className="text-sm font-semibold" />
                      {due > 0 && due !== inv.totalCents && (
                        <span className="tnum block text-2xs text-faint">{fmtMoney(due)} due</span>
                      )}
                    </span>
                    <span className="w-20 flex-none text-right text-2xs text-faint">
                      {inv.status === "paid" && inv.paidAt
                        ? `paid ${inv.paidAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
                        : inv.dueAt ? `due ${inv.dueAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </>
  );
}

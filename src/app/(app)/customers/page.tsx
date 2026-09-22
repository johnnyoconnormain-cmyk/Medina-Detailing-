import type { Metadata } from "next";
import Link from "next/link";
import { requireCtx } from "@/lib/tenant";
import { db } from "@/db/client";
import { and, eq, ilike, or, sql, desc } from "drizzle-orm";
import { customers, jobs, invoices } from "@/db/schema";
import { TopBar } from "@/components/shell/TopBar";
import { EmptyState, Money, Chip } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Customers" };
export const dynamic = "force-dynamic";

export default async function CustomersPage({ searchParams }: {
  searchParams: Promise<{ q?: string; tag?: string }>;
}) {
  const ctx = await requireCtx();
  const sp = await searchParams;
  const term = sp.q?.trim();

  const conditions = [eq(customers.businessId, ctx.businessId)];
  if (term) {
    conditions.push(or(
      ilike(customers.name, `%${term}%`),
      ilike(customers.phone, `%${term}%`),
      ilike(customers.addressLine, `%${term}%`),
      ilike(customers.city, `%${term}%`),
    )!);
  }
  if (sp.tag) conditions.push(sql`${customers.tags} ? ${sp.tag}`);

  const rows = await db.select({
    id: customers.id, name: customers.name, phone: customers.phone,
    city: customers.city, tags: customers.tags,
    jobCount: sql<number>`(select count(*) from jobs j where j.customer_id = customers.id)::int`,
    lifetimeCents: sql<number>`(select coalesce(sum(i.amount_paid_cents),0) from invoices i where i.customer_id = customers.id)::int`,
    openCents: sql<number>`(select coalesce(sum(i.total_cents - i.amount_paid_cents),0) from invoices i where i.customer_id = customers.id and i.status <> 'paid')::int`,
    lastJob: sql<Date | null>`(select max(j.scheduled_start) from jobs j where j.customer_id = customers.id)`,
  }).from(customers).where(and(...conditions))
    .orderBy(desc(sql`(select coalesce(sum(i.amount_paid_cents),0) from invoices i where i.customer_id = customers.id)`))
    .limit(300);

  const lifetime = rows.reduce((n, r) => n + r.lifetimeCents, 0);

  return (
    <>
      <TopBar title="Customers" subtitle={`${rows.length} · $${Math.round(lifetime / 100).toLocaleString("en-US")} lifetime revenue`}
              right={<Link href="/customers/new" className="btn btn-secondary !px-2.5 !py-1.5 text-xs">Add</Link>} />

      <div className="border-b px-4 py-2" style={{ borderColor: "rgb(var(--border))" }}>
        <form className="flex gap-2">
          <input name="q" defaultValue={term} placeholder="Search name, phone, address…"
                 className="input max-w-sm !py-1.5 text-xs" aria-label="Search customers" />
          <button className="btn btn-secondary !px-3 !py-1.5 text-xs">Search</button>
          {(term || sp.tag) && <Link href="/customers" className="btn btn-ghost !px-2 !py-1.5 text-xs">Clear</Link>}
        </form>
      </div>

      <main className="mx-auto w-full max-w-[1400px] flex-1 p-3 sm:p-4">
        {rows.length === 0 ? (
          <div className="card"><EmptyState title="No customers found" /></div>
        ) : (
          <ul className="card divide-y overflow-hidden" style={{ borderColor: "rgb(var(--border))" }}>
            {rows.map((c) => (
              <li key={c.id}>
                <Link href={`/customers/${c.id}`} className="row-link flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">{c.name}</span>
                      {c.tags.map((t) => <Chip key={t} tone="neutral">{t}</Chip>)}
                    </span>
                    <span className="block truncate text-xs text-muted">
                      {[c.city, c.phone].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <span className="tnum w-16 flex-none text-right text-xs text-muted">
                    {c.jobCount} job{c.jobCount === 1 ? "" : "s"}
                  </span>
                  {c.openCents > 0 && (
                    <span className="w-20 flex-none text-right">
                      <Money cents={c.openCents} className="text-xs font-semibold text-clay-600 dark:text-clay-400" />
                      <span className="block text-2xs text-faint">open</span>
                    </span>
                  )}
                  <Money cents={c.lifetimeCents} className="w-24 flex-none text-right text-sm font-semibold" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}

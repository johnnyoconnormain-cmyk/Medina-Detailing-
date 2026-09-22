import type { Metadata } from "next";
import Link from "next/link";
import { requireCtx } from "@/lib/tenant";
import { db } from "@/db/client";
import { and, eq, desc, inArray } from "drizzle-orm";
import { jobs, customers, crews } from "@/db/schema";
import { TopBar } from "@/components/shell/TopBar";
import { StatusChip, Money, EmptyState } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Jobs" };
export const dynamic = "force-dynamic";

const TABS = [
  { k: "active", l: "Active", s: ["unscheduled", "scheduled", "in_progress"] },
  { k: "complete", l: "Complete", s: ["complete"] },
  { k: "all", l: "All", s: [] },
];

export default async function JobsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const ctx = await requireCtx();
  const sp = await searchParams;
  const tab = TABS.find((t) => t.k === sp.status) ?? TABS[0];

  const rows = await db.select({
    id: jobs.id, number: jobs.number, title: jobs.title, status: jobs.status,
    scheduledStart: jobs.scheduledStart, valueCents: jobs.valueCents, city: jobs.city,
    customerName: customers.name, crewName: crews.name, crewColor: crews.color,
  }).from(jobs)
    .innerJoin(customers, eq(jobs.customerId, customers.id))
    .leftJoin(crews, eq(jobs.crewId, crews.id))
    .where(tab.s.length
      ? and(eq(jobs.businessId, ctx.businessId), inArray(jobs.status, tab.s as never))
      : eq(jobs.businessId, ctx.businessId))
    .orderBy(desc(jobs.scheduledStart)).limit(200);

  return (
    <>
      <TopBar title="Jobs" subtitle={`${rows.length} ${tab.l.toLowerCase()}`} />
      <div className="border-b px-4 py-2" style={{ borderColor: "rgb(var(--border))" }}>
        <div className="flex gap-1">
          {TABS.map((t) => (
            <Link key={t.k} href={`/jobs?status=${t.k}`}
              className={`rounded px-2.5 py-1 text-xs font-medium ${
                t.k === tab.k ? "bg-bark-900 text-white dark:bg-bark-100 dark:text-bark-950" : "text-muted hover:bg-[rgb(var(--surface-2))]"
              }`}>{t.l}</Link>
          ))}
        </div>
      </div>

      <main className="mx-auto w-full max-w-[1400px] flex-1 p-3 sm:p-4">
        {rows.length === 0 ? (
          <div className="card"><EmptyState title="No jobs here" /></div>
        ) : (
          <ul className="card divide-y overflow-hidden" style={{ borderColor: "rgb(var(--border))" }}>
            {rows.map((j) => (
              <li key={j.id}>
                <Link href={`/jobs/${j.id}`} className="row-link flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3">
                  <span className="h-8 w-[3px] flex-none rounded-full" style={{ background: j.crewColor ?? "rgb(var(--border-strong))" }} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{j.customerName}</span>
                    <span className="block truncate text-xs text-muted">{j.title}{j.city ? ` · ${j.city}` : ""}</span>
                  </span>
                  <span className="tnum w-24 flex-none text-right text-2xs text-faint">
                    {j.scheduledStart?.toLocaleDateString("en-US", { month: "short", day: "numeric" }) ?? "unscheduled"}
                  </span>
                  <StatusChip status={j.status} />
                  <Money cents={j.valueCents} className="w-20 flex-none text-right text-sm font-semibold" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { requireCtx } from "@/lib/tenant";
import { db } from "@/db/client";
import { and, eq, gte, lt, isNull, asc, desc } from "drizzle-orm";
import { jobs, customers, crews, quotes } from "@/db/schema";
import { TopBar } from "@/components/shell/TopBar";
import { Card, SectionHeader, StatusChip, Money, EmptyState, Chip } from "@/components/ui/primitives";
import { ScheduleBoard } from "./ScheduleBoard";

export const metadata: Metadata = { title: "Schedule" };
export const dynamic = "force-dynamic";

const DAY = 864e5;

export default async function SchedulePage({ searchParams }: {
  searchParams: Promise<{ week?: string; filter?: string }>;
}) {
  const ctx = await requireCtx();
  const sp = await searchParams;
  const weekOffset = Number(sp.week ?? 0) || 0;

  const now = new Date();
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7) + weekOffset * 7);
  const weekEnd = new Date(monday.getTime() + 7 * DAY);

  const [weekJobs, crewRows, unscheduled, needsScheduling] = await Promise.all([
    db.select({
      id: jobs.id, number: jobs.number, title: jobs.title, status: jobs.status,
      scheduledStart: jobs.scheduledStart, scheduledEnd: jobs.scheduledEnd,
      valueCents: jobs.valueCents, crewId: jobs.crewId, city: jobs.city,
      customerName: customers.name, crewName: crews.name, crewColor: crews.color,
    }).from(jobs)
      .innerJoin(customers, eq(jobs.customerId, customers.id))
      .leftJoin(crews, eq(jobs.crewId, crews.id))
      .where(and(eq(jobs.businessId, ctx.businessId), gte(jobs.scheduledStart, monday), lt(jobs.scheduledStart, weekEnd)))
      .orderBy(asc(jobs.scheduledStart)),

    db.select().from(crews).where(and(eq(crews.businessId, ctx.businessId), eq(crews.active, true))).orderBy(asc(crews.name)),

    db.select({
      id: jobs.id, number: jobs.number, title: jobs.title, valueCents: jobs.valueCents,
      customerName: customers.name, city: jobs.city, createdAt: jobs.createdAt,
    }).from(jobs).innerJoin(customers, eq(jobs.customerId, customers.id))
      .where(and(eq(jobs.businessId, ctx.businessId), eq(jobs.status, "unscheduled")))
      .orderBy(desc(jobs.createdAt)),

    db.select({ n: quotes.id }).from(quotes)
      .leftJoin(jobs, eq(jobs.quoteId, quotes.id))
      .where(and(eq(quotes.businessId, ctx.businessId), eq(quotes.status, "accepted"), isNull(jobs.id))),
  ]);

  const weekTotal = weekJobs.reduce((n, j) => n + j.valueCents, 0);
  const label = `${monday.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${new Date(weekEnd.getTime() - DAY).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;

  return (
    <>
      <TopBar title="Schedule" subtitle={`${label} · ${weekJobs.length} jobs · $${Math.round(weekTotal / 100).toLocaleString("en-US")}`}
        right={
          <div className="flex gap-1">
            <Link href={`/schedule?week=${weekOffset - 1}`} className="btn btn-ghost border border-[rgb(var(--border))] !px-2 !py-1 text-xs">←</Link>
            <Link href="/schedule" className="btn btn-ghost border border-[rgb(var(--border))] !px-2 !py-1 text-xs">Today</Link>
            <Link href={`/schedule?week=${weekOffset + 1}`} className="btn btn-ghost border border-[rgb(var(--border))] !px-2 !py-1 text-xs">→</Link>
          </div>
        } />

      <main className="mx-auto w-full max-w-[1500px] flex-1 space-y-3 p-3 sm:p-4">
        {unscheduled.length > 0 && (
          <Card className="overflow-hidden border-clay-300 dark:border-clay-900">
            <SectionHeader title="Waiting to be scheduled" count={unscheduled.length} />
            <ul className="divide-y" style={{ borderColor: "rgb(var(--border))" }}>
              {unscheduled.map((j) => (
                <li key={j.id}>
                  <Link href={`/jobs/${j.id}`} className="row-link flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{j.customerName}</span>
                      <span className="block truncate text-xs text-muted">{j.title}{j.city ? ` · ${j.city}` : ""}</span>
                    </span>
                    <Chip tone="warning">needs a date</Chip>
                    <Money cents={j.valueCents} className="text-sm font-semibold" />
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}

        <ScheduleBoard
          weekStartIso={monday.toISOString()}
          jobs={weekJobs.map((j) => ({
            ...j,
            scheduledStart: j.scheduledStart?.toISOString() ?? null,
            scheduledEnd: j.scheduledEnd?.toISOString() ?? null,
          }))}
          crews={crewRows.map((c) => ({ id: c.id, name: c.name, color: c.color }))}
        />

        {weekJobs.length === 0 && unscheduled.length === 0 && (
          <Card><EmptyState title="Nothing scheduled this week"
            hint="Accepted quotes turn into jobs automatically and land here waiting for a date." /></Card>
        )}
      </main>
    </>
  );
}

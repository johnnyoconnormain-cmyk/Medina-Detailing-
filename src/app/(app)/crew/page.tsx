import type { Metadata } from "next";
import Link from "next/link";
import { requireCtx } from "@/lib/tenant";
import { db } from "@/db/client";
import { and, eq, gte, lt, asc, sql } from "drizzle-orm";
import { jobs, customers, crews, crewMembers, jobChecklistItems } from "@/db/schema";
import { fmtMoney } from "@/lib/money";
import { StatusChip } from "@/components/ui/primitives";
import { logoutAction } from "@/actions/auth";

export const metadata: Metadata = { title: "Today" };
export const dynamic = "force-dynamic";

/**
 * The field view. Designed for a phone in a glove at 7am, not a shrunken
 * desktop table: big tap targets, the address and phone one tap away, and
 * only today's work.
 */
export default async function CrewPage() {
  const ctx = await requireCtx();
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start.getTime() + 864e5);

  const myCrews = await db.select({ crewId: crewMembers.crewId })
    .from(crewMembers).where(eq(crewMembers.userId, ctx.user.id));
  const crewIds = myCrews.map((c) => c.crewId);

  const rows = await db.select({
    id: jobs.id, number: jobs.number, title: jobs.title, status: jobs.status,
    scheduledStart: jobs.scheduledStart, valueCents: jobs.valueCents,
    addressLine: jobs.addressLine, city: jobs.city, state: jobs.state,
    crewNotes: jobs.crewNotes,
    customerName: customers.name, customerPhone: customers.phone,
    crewName: crews.name, crewColor: crews.color, crewId: jobs.crewId,
    doneCount: sql<number>`(select count(*) from job_checklist_items ci where ci.job_id = jobs.id and ci.done)::int`,
    totalCount: sql<number>`(select count(*) from job_checklist_items ci where ci.job_id = jobs.id)::int`,
  }).from(jobs)
    .innerJoin(customers, eq(jobs.customerId, customers.id))
    .leftJoin(crews, eq(jobs.crewId, crews.id))
    .where(and(eq(jobs.businessId, ctx.businessId), gte(jobs.scheduledStart, start), lt(jobs.scheduledStart, end)))
    .orderBy(asc(jobs.scheduledStart));

  // Crew members see their own crew's work first; owners see everything.
  const mine = crewIds.length ? rows.filter((r) => r.crewId && crewIds.includes(r.crewId)) : [];
  const list = mine.length ? mine : rows;
  const total = list.reduce((n, j) => n + j.valueCents, 0);
  const doneJobs = list.filter((j) => j.status === "complete").length;

  return (
    <div className="mx-auto w-full max-w-lg px-3 pb-16 pt-4">
      <header className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="label-xs">{now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</p>
          <h1 className="text-xl font-semibold tracking-tight">Hi, {ctx.user.name.split(" ")[0]}</h1>
        </div>
        <form action={logoutAction}>
          <button className="btn btn-ghost border border-[rgb(var(--border))] text-xs">Sign out</button>
        </form>
      </header>

      <div className="card mb-3 flex divide-x px-1 py-2.5" style={{ borderColor: "rgb(var(--border))" }}>
        <Stat label="Jobs" value={String(list.length)} />
        <Stat label="Done" value={`${doneJobs}/${list.length}`} />
        <Stat label="Value" value={fmtMoney(total)} />
      </div>

      {list.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-sm font-medium">Nothing scheduled today</p>
          <p className="mt-1 text-xs text-muted">Enjoy it.</p>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {list.map((j) => {
            const maps = j.addressLine
              ? `https://maps.google.com/?q=${encodeURIComponent(`${j.addressLine}, ${j.city ?? ""} ${j.state ?? ""}`)}`
              : null;
            return (
              <li key={j.id} className="card overflow-hidden">
                <Link href={`/jobs/${j.id}`} className="block px-4 pb-3 pt-3.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="tnum text-sm font-bold">
                      {j.scheduledStart?.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                    </span>
                    <StatusChip status={j.status} />
                  </div>
                  <p className="mt-1.5 text-base font-semibold leading-tight">{j.customerName}</p>
                  <p className="text-sm text-muted">{j.title}</p>
                  {j.addressLine && <p className="mt-1 text-xs text-faint">{j.addressLine}, {j.city}</p>}
                  {j.totalCount > 0 && (
                    <div className="mt-2 flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full" style={{ background: "rgb(var(--surface-2))" }}>
                        <div className="h-full rounded-full bg-moss-500" style={{ width: `${(j.doneCount / j.totalCount) * 100}%` }} />
                      </div>
                      <span className="tnum text-2xs text-faint">{j.doneCount}/{j.totalCount}</span>
                    </div>
                  )}
                  {j.crewNotes && (
                    <p className="mt-2 rounded bg-clay-50 px-2 py-1.5 text-2xs text-clay-900 dark:bg-clay-950 dark:text-clay-200">
                      {j.crewNotes}
                    </p>
                  )}
                </Link>

                <div className="grid grid-cols-3 divide-x border-t" style={{ borderColor: "rgb(var(--border))" }}>
                  <a href={j.customerPhone ? `tel:${j.customerPhone}` : undefined}
                     className={`py-2.5 text-center text-xs font-semibold ${j.customerPhone ? "text-moss-700 dark:text-moss-400" : "text-faint"}`}>
                    Call
                  </a>
                  <a href={j.customerPhone ? `sms:${j.customerPhone}` : undefined}
                     className={`py-2.5 text-center text-xs font-semibold ${j.customerPhone ? "text-moss-700 dark:text-moss-400" : "text-faint"}`}>
                    Text
                  </a>
                  <a href={maps ?? undefined} target="_blank" rel="noopener"
                     className={`py-2.5 text-center text-xs font-semibold ${maps ? "text-moss-700 dark:text-moss-400" : "text-faint"}`}>
                    Navigate
                  </a>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex-1 px-2 text-center" style={{ borderColor: "rgb(var(--border))" }}>
      <p className="label-xs">{label}</p>
      <p className="tnum text-base font-semibold">{value}</p>
    </div>
  );
}

import "server-only";
import { db } from "@/db/client";
import { and, eq, gte, lte, lt, inArray, desc, sql, isNull, isNotNull, ne } from "drizzle-orm";
import {
  jobs, leads, quotes, invoices, customers, crews, activityEvents, scheduledTasks, reviews, services, payments,
} from "@/db/schema";
import { pctChange } from "../money";

const DAY = 864e5;

export function dayBounds(offset = 0) {
  const n = new Date();
  const start = new Date(n.getFullYear(), n.getMonth(), n.getDate() + offset);
  return { start, end: new Date(start.getTime() + DAY) };
}

function weekBounds(offset = 0) {
  const n = new Date();
  const day = n.getDay();
  const monday = new Date(n.getFullYear(), n.getMonth(), n.getDate() - ((day + 6) % 7) + offset * 7);
  return { start: monday, end: new Date(monday.getTime() + 7 * DAY) };
}

/* ------------------------------------------------------------- pulse tiles */

export type Pulse = {
  revenueWeekCents: number;
  revenueWeekChangePct: number | null;
  activeJobs: number;
  newLeads: number;
  quotesAwaiting: number;
  quotesAwaitingValueCents: number;
  onTimePct: number | null;
  onTimeSample: number;
};

export async function getPulse(businessId: string): Promise<Pulse> {
  const thisWeek = weekBounds(0);
  const lastWeek = weekBounds(-1);

  // Compare like for like: week-to-date against the SAME elapsed slice of last
  // week. Measuring two days against a full seven would report a crash every
  // Monday morning and train the owner to ignore the number.
  const elapsedMs = Date.now() - thisWeek.start.getTime();
  const lastWeekCutoff = new Date(lastWeek.start.getTime() + elapsedMs);

  const [revNow, revPrev] = await Promise.all([
    db.select({ total: sql<number>`coalesce(sum(${payments.amountCents}), 0)::int` })
      .from(payments)
      .where(and(eq(payments.businessId, businessId), gte(payments.createdAt, thisWeek.start), lt(payments.createdAt, thisWeek.end))),
    db.select({ total: sql<number>`coalesce(sum(${payments.amountCents}), 0)::int` })
      .from(payments)
      .where(and(eq(payments.businessId, businessId), gte(payments.createdAt, lastWeek.start), lt(payments.createdAt, lastWeekCutoff))),
  ]);

  const [active] = await db.select({ n: sql<number>`count(*)::int` }).from(jobs)
    .where(and(eq(jobs.businessId, businessId), inArray(jobs.status, ["scheduled", "in_progress", "unscheduled"])));

  const [fresh] = await db.select({ n: sql<number>`count(*)::int` }).from(leads)
    .where(and(eq(leads.businessId, businessId), inArray(leads.status, ["new", "contacted"])));

  const [awaiting] = await db.select({
    n: sql<number>`count(*)::int`,
    total: sql<number>`coalesce(sum(${quotes.totalCents}), 0)::int`,
  }).from(quotes)
    .where(and(eq(quotes.businessId, businessId), inArray(quotes.status, ["sent", "viewed"])));

  // On-time = completed at or before the scheduled end, over the last 60 days.
  const since = new Date(Date.now() - 60 * DAY);
  const [onTime] = await db.select({
    total: sql<number>`count(*)::int`,
    ok: sql<number>`count(*) filter (where ${jobs.completedAt} <= ${jobs.scheduledEnd} + interval '30 minutes')::int`,
  }).from(jobs)
    .where(and(
      eq(jobs.businessId, businessId), eq(jobs.status, "complete"),
      isNotNull(jobs.completedAt), isNotNull(jobs.scheduledEnd),
      gte(jobs.completedAt, since),
    ));

  return {
    revenueWeekCents: revNow[0]?.total ?? 0,
    revenueWeekChangePct: pctChange(revNow[0]?.total ?? 0, revPrev[0]?.total ?? 0),
    activeJobs: active?.n ?? 0,
    newLeads: fresh?.n ?? 0,
    quotesAwaiting: awaiting?.n ?? 0,
    quotesAwaitingValueCents: awaiting?.total ?? 0,
    onTimePct: onTime && onTime.total > 0 ? Math.round((onTime.ok / onTime.total) * 100) : null,
    onTimeSample: onTime?.total ?? 0,
  };
}

/* ----------------------------------------------------------- pipeline rail */

export type PipelineStage = {
  key: string; label: string; count: number; valueCents: number;
  changePct: number | null; urgent: number; href: string;
};

export async function getPipeline(businessId: string): Promise<PipelineStage[]> {
  const today = dayBounds(0);
  const weekAgo = new Date(Date.now() - 7 * DAY);
  const twoWeeksAgo = new Date(Date.now() - 14 * DAY);

  const [leadNow, leadPrev, quoteAgg, bookedAgg, todayAgg, completeAgg, paidAgg, staleQuotes, unassigned] =
    await Promise.all([
      db.select({ n: sql<number>`count(*)::int` }).from(leads)
        .where(and(eq(leads.businessId, businessId), inArray(leads.status, ["new", "contacted"]))),
      db.select({ n: sql<number>`count(*)::int` }).from(leads)
        .where(and(eq(leads.businessId, businessId), gte(leads.createdAt, twoWeeksAgo), lt(leads.createdAt, weekAgo))),
      db.select({ n: sql<number>`count(*)::int`, total: sql<number>`coalesce(sum(${quotes.totalCents}),0)::int` })
        .from(quotes).where(and(eq(quotes.businessId, businessId), inArray(quotes.status, ["sent", "viewed"]))),
      db.select({ n: sql<number>`count(*)::int`, total: sql<number>`coalesce(sum(${jobs.valueCents}),0)::int` })
        .from(jobs).where(and(eq(jobs.businessId, businessId), inArray(jobs.status, ["scheduled", "unscheduled"]))),
      db.select({ n: sql<number>`count(*)::int`, total: sql<number>`coalesce(sum(${jobs.valueCents}),0)::int` })
        .from(jobs).where(and(
          eq(jobs.businessId, businessId),
          gte(jobs.scheduledStart, today.start), lt(jobs.scheduledStart, today.end),
        )),
      db.select({ n: sql<number>`count(*)::int`, total: sql<number>`coalesce(sum(${jobs.valueCents}),0)::int` })
        .from(jobs).where(and(
          eq(jobs.businessId, businessId), eq(jobs.status, "complete"), gte(jobs.completedAt, weekAgo),
        )),
      db.select({ total: sql<number>`coalesce(sum(${payments.amountCents}),0)::int`, n: sql<number>`count(*)::int` })
        .from(payments).where(and(eq(payments.businessId, businessId), gte(payments.createdAt, weekAgo))),
      db.select({ n: sql<number>`count(*)::int` }).from(quotes)
        .where(and(
          eq(quotes.businessId, businessId), inArray(quotes.status, ["sent", "viewed"]),
          lt(quotes.sentAt, new Date(Date.now() - 3 * DAY)),
        )),
      db.select({ n: sql<number>`count(*)::int` }).from(jobs)
        .where(and(eq(jobs.businessId, businessId), eq(jobs.status, "scheduled"), isNull(jobs.crewId))),
    ]);

  return [
    { key: "leads", label: "Leads", count: leadNow[0]?.n ?? 0, valueCents: 0,
      changePct: pctChange(leadNow[0]?.n ?? 0, leadPrev[0]?.n ?? 0), urgent: 0, href: "/leads" },
    { key: "quotes", label: "Quotes", count: quoteAgg[0]?.n ?? 0, valueCents: quoteAgg[0]?.total ?? 0,
      changePct: null, urgent: staleQuotes[0]?.n ?? 0, href: "/quotes" },
    { key: "booked", label: "Booked", count: bookedAgg[0]?.n ?? 0, valueCents: bookedAgg[0]?.total ?? 0,
      changePct: null, urgent: unassigned[0]?.n ?? 0, href: "/schedule" },
    { key: "today", label: "Today", count: todayAgg[0]?.n ?? 0, valueCents: todayAgg[0]?.total ?? 0,
      changePct: null, urgent: 0, href: "/schedule" },
    { key: "complete", label: "Complete", count: completeAgg[0]?.n ?? 0, valueCents: completeAgg[0]?.total ?? 0,
      changePct: null, urgent: 0, href: "/jobs" },
    { key: "paid", label: "Paid", count: paidAgg[0]?.n ?? 0, valueCents: paidAgg[0]?.total ?? 0,
      changePct: null, urgent: 0, href: "/invoices" },
  ];
}

/* -------------------------------------------------------------- today rail */

export async function getTodayJobs(businessId: string) {
  const { start, end } = dayBounds(0);
  return db.select({
    id: jobs.id, number: jobs.number, title: jobs.title, status: jobs.status,
    scheduledStart: jobs.scheduledStart, scheduledEnd: jobs.scheduledEnd,
    valueCents: jobs.valueCents, addressLine: jobs.addressLine, city: jobs.city,
    customerName: customers.name, customerPhone: customers.phone,
    crewName: crews.name, crewColor: crews.color, crewId: crews.id,
  }).from(jobs)
    .innerJoin(customers, eq(jobs.customerId, customers.id))
    .leftJoin(crews, eq(jobs.crewId, crews.id))
    .where(and(eq(jobs.businessId, businessId), gte(jobs.scheduledStart, start), lt(jobs.scheduledStart, end)))
    .orderBy(jobs.scheduledStart);
}

/* --------------------------------------------------------- attention items */

export type AttentionItem = {
  id: string; severity: "critical" | "high" | "medium" | "low";
  title: string; detail: string; amountCents: number | null;
  actionLabel: string; href: string;
};

/**
 * Ranked by what actually costs the owner money if ignored. Only items with
 * real rows behind them are returned — an empty attention list is a valid,
 * meaningful answer, not something to pad.
 */
export async function getAttentionItems(businessId: string): Promise<AttentionItem[]> {
  const items: AttentionItem[] = [];
  const threeDaysAgo = new Date(Date.now() - 3 * DAY);
  const tomorrow = dayBounds(1);

  // Only quotes with NO pending automation. Telling the owner to chase a quote
  // the system already has queued is noise, and noise is how an attention list
  // gets ignored.
  const stale = await db.select({
    n: sql<number>`count(*)::int`, total: sql<number>`coalesce(sum(${quotes.totalCents}),0)::int`,
  }).from(quotes).where(and(
    eq(quotes.businessId, businessId), inArray(quotes.status, ["sent", "viewed"]), lt(quotes.sentAt, threeDaysAgo),
    sql`not exists (
      select 1 from scheduled_tasks st
      where st.entity_type = 'quote' and st.entity_id = quotes.id and st.status = 'pending'
    )`,
  ));
  if (stale[0]?.n > 0) {
    items.push({
      id: "stale-quotes", severity: "critical",
      title: `${stale[0].n} quote${stale[0].n === 1 ? "" : "s"} with no follow-up`,
      detail: "Sent over 3 days ago, unanswered, nothing queued",
      amountCents: stale[0].total, actionLabel: "Follow up", href: "/quotes?filter=stale",
    });
  }

  const unassigned = await db.select({ n: sql<number>`count(*)::int` }).from(jobs).where(and(
    eq(jobs.businessId, businessId), eq(jobs.status, "scheduled"), isNull(jobs.crewId),
    gte(jobs.scheduledStart, tomorrow.start), lt(jobs.scheduledStart, new Date(tomorrow.start.getTime() + 3 * DAY)),
  ));
  if (unassigned[0]?.n > 0) {
    items.push({
      id: "unassigned", severity: "high",
      title: `${unassigned[0].n} job${unassigned[0].n === 1 ? "" : "s"} without a crew`,
      detail: "Scheduled in the next 3 days", amountCents: null,
      actionLabel: "Assign crew", href: "/schedule?filter=unassigned",
    });
  }

  const overdue = await db.select({
    n: sql<number>`count(*)::int`,
    total: sql<number>`coalesce(sum(${invoices.totalCents} - ${invoices.amountPaidCents}),0)::int`,
  }).from(invoices).where(and(
    eq(invoices.businessId, businessId), inArray(invoices.status, ["sent", "overdue"]),
  ));
  if (overdue[0]?.n > 0) {
    items.push({
      id: "outstanding", severity: "medium",
      title: `${overdue[0].n} unpaid invoice${overdue[0].n === 1 ? "" : "s"}`,
      detail: "Sent but not yet collected", amountCents: overdue[0].total,
      actionLabel: "Send reminder", href: "/invoices?filter=unpaid",
    });
  }

  const reviewReady = await db.select({ n: sql<number>`count(*)::int` }).from(reviews).where(and(
    eq(reviews.businessId, businessId), isNull(reviews.rating), isNotNull(reviews.requestedAt),
  ));
  if (reviewReady[0]?.n > 0) {
    items.push({
      id: "reviews", severity: "low",
      title: `${reviewReady[0].n} customer${reviewReady[0].n === 1 ? "" : "s"} ready for a review request`,
      detail: "Job complete and paid, no review yet", amountCents: null,
      actionLabel: "Request reviews", href: "/reviews",
    });
  }

  const newLeads = await db.select({ n: sql<number>`count(*)::int` }).from(leads).where(and(
    eq(leads.businessId, businessId), eq(leads.status, "new"),
    lt(leads.createdAt, new Date(Date.now() - 4 * 36e5)),
  ));
  if (newLeads[0]?.n > 0) {
    items.push({
      id: "unanswered-leads", severity: "critical",
      title: `${newLeads[0].n} lead${newLeads[0].n === 1 ? "" : "s"} waiting on a reply`,
      detail: "Received more than 4 hours ago", amountCents: null,
      actionLabel: "Open inbox", href: "/leads",
    });
  }

  const order = { critical: 0, high: 1, medium: 2, low: 3 };
  return items.sort((a, b) => order[a.severity] - order[b.severity]);
}

/* ------------------------------------------------------------ revenue data */

export type RevenuePoint = { date: string; revenueCents: number; jobs: number };

export async function getRevenueSeries(businessId: string, days: number): Promise<RevenuePoint[]> {
  const since = new Date(Date.now() - days * DAY);

  const rows = await db.select({
    day: sql<string>`to_char(date_trunc('day', ${payments.createdAt}), 'YYYY-MM-DD')`,
    total: sql<number>`coalesce(sum(${payments.amountCents}),0)::int`,
    n: sql<number>`count(*)::int`,
  }).from(payments)
    .where(and(eq(payments.businessId, businessId), gte(payments.createdAt, since)))
    .groupBy(sql`date_trunc('day', ${payments.createdAt})`)
    .orderBy(sql`date_trunc('day', ${payments.createdAt})`);

  // Fill gaps so the chart's x-axis is continuous rather than skipping quiet days.
  const byDay = new Map(rows.map((r) => [r.day, r]));
  const out: RevenuePoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * DAY);
    const key = d.toISOString().slice(0, 10);
    const hit = byDay.get(key);
    out.push({ date: key, revenueCents: hit?.total ?? 0, jobs: hit?.n ?? 0 });
  }
  return out;
}

/* -------------------------------------------------------------- lead funnel */

export async function getLeadFunnel(businessId: string, days = 30) {
  const since = new Date(Date.now() - days * DAY);

  /*
   * A true cohort funnel: take the leads created in the window and follow THAT
   * SET through each stage. Counting stage volumes independently produces the
   * nonsense of more "paid" than "accepted", because the rows are different
   * populations. A funnel that widens is a broken funnel.
   */
  const [row] = await db.select({
    total: sql<number>`count(distinct l.id)::int`,
    qualified: sql<number>`count(distinct l.id) filter (where l.status not in ('archived','lost'))::int`,
    quoted: sql<number>`count(distinct q.id)::int`,
    accepted: sql<number>`count(distinct q.id) filter (where q.status = 'accepted')::int`,
    completed: sql<number>`count(distinct j.id) filter (where j.status = 'complete')::int`,
    paid: sql<number>`count(distinct i.id) filter (where i.status = 'paid')::int`,
  }).from(sql`${leads} l`)
    .leftJoin(sql`${quotes} q`, sql`q.lead_id = l.id`)
    .leftJoin(sql`${jobs} j`, sql`j.quote_id = q.id`)
    .leftJoin(sql`${invoices} i`, sql`i.job_id = j.id`)
    .where(sql`l.business_id = ${businessId} and l.created_at >= ${since.toISOString()}`);

  return [
    { key: "leads", label: "Leads", count: row?.total ?? 0, href: "/leads" },
    { key: "qualified", label: "Qualified", count: row?.qualified ?? 0, href: "/leads?status=contacted" },
    { key: "quoted", label: "Quotes sent", count: row?.quoted ?? 0, href: "/quotes" },
    { key: "accepted", label: "Accepted", count: row?.accepted ?? 0, href: "/quotes?status=accepted" },
    { key: "completed", label: "Completed", count: row?.completed ?? 0, href: "/jobs?status=complete" },
    { key: "paid", label: "Paid", count: row?.paid ?? 0, href: "/invoices?status=paid" },
  ];
}

/* ------------------------------------------------------------- crew status */

export async function getCrewStatus(businessId: string) {
  const { start, end } = dayBounds(0);
  const rows = await db.select({
    id: crews.id, name: crews.name, color: crews.color, status: crews.status,
    jobId: jobs.id, jobTitle: jobs.title, jobStatus: jobs.status,
    scheduledStart: jobs.scheduledStart, scheduledEnd: jobs.scheduledEnd,
    customerName: customers.name, valueCents: jobs.valueCents,
  }).from(crews)
    .leftJoin(jobs, and(
      eq(jobs.crewId, crews.id),
      gte(jobs.scheduledStart, start), lt(jobs.scheduledStart, end),
    ))
    .leftJoin(customers, eq(jobs.customerId, customers.id))
    .where(and(eq(crews.businessId, businessId), eq(crews.active, true)))
    .orderBy(crews.name, jobs.scheduledStart);

  const byCrew = new Map<string, {
    id: string; name: string; color: string; status: string;
    jobs: Array<{ id: string; title: string; status: string; start: Date | null; end: Date | null; customer: string | null; valueCents: number }>;
  }>();

  for (const r of rows) {
    if (!byCrew.has(r.id)) byCrew.set(r.id, { id: r.id, name: r.name, color: r.color, status: r.status, jobs: [] });
    if (r.jobId) {
      byCrew.get(r.id)!.jobs.push({
        id: r.jobId, title: r.jobTitle!, status: r.jobStatus!,
        start: r.scheduledStart, end: r.scheduledEnd,
        customer: r.customerName, valueCents: r.valueCents ?? 0,
      });
    }
  }
  return [...byCrew.values()];
}

/* ----------------------------------------------------------- activity feed */

export async function getActivity(businessId: string, limit = 12) {
  return db.select().from(activityEvents)
    .where(eq(activityEvents.businessId, businessId))
    .orderBy(desc(activityEvents.createdAt))
    .limit(limit);
}

/* --------------------------------------------------- revenue opportunities */

export async function getOpportunities(businessId: string) {
  const [openQuotes, unpaid, recurring] = await Promise.all([
    db.select({
      n: sql<number>`count(distinct ${quotes.customerId})::int`,
      total: sql<number>`coalesce(sum(${quotes.totalCents}),0)::int`,
    }).from(quotes).where(and(eq(quotes.businessId, businessId), inArray(quotes.status, ["sent", "viewed"]))),
    db.select({
      n: sql<number>`count(distinct ${invoices.customerId})::int`,
      total: sql<number>`coalesce(sum(${invoices.totalCents} - ${invoices.amountPaidCents}),0)::int`,
    }).from(invoices).where(and(eq(invoices.businessId, businessId), inArray(invoices.status, ["sent", "overdue"]))),
    db.select({
      n: sql<number>`count(distinct ${jobs.customerId})::int`,
      avg: sql<number>`coalesce(avg(${jobs.valueCents}),0)::int`,
    }).from(jobs).innerJoin(services, eq(services.businessId, jobs.businessId))
      .where(and(
        eq(jobs.businessId, businessId), eq(jobs.status, "complete"),
        gte(jobs.completedAt, new Date(Date.now() - 120 * DAY)),
        eq(services.recurring, true), eq(jobs.title, services.name),
      )),
  ]);

  const out = [
    openQuotes[0]?.total > 0 && {
      key: "open-quotes", amountCents: openQuotes[0].total,
      label: "Sitting in open quotes", sub: `${openQuotes[0].n} customer${openQuotes[0].n === 1 ? "" : "s"}`,
      actionLabel: "View quotes", href: "/quotes",
    },
    unpaid[0]?.total > 0 && {
      key: "unpaid", amountCents: unpaid[0].total,
      label: "Outstanding invoices", sub: `${unpaid[0].n} customer${unpaid[0].n === 1 ? "" : "s"}`,
      actionLabel: "Collect payments", href: "/invoices?filter=unpaid",
    },
    recurring[0]?.n > 0 && {
      key: "recurring", amountCents: recurring[0].n * recurring[0].avg,
      label: "Recurring maintenance value", sub: `${recurring[0].n} active customer${recurring[0].n === 1 ? "" : "s"}`,
      actionLabel: "View customers", href: "/customers?tag=recurring",
    },
  ].filter(Boolean);

  return out as Array<{ key: string; amountCents: number; label: string; sub: string; actionLabel: string; href: string }>;
}

/* ---------------------------------------------------------------- insights */

export type Insight = { id: string; text: string; tone: "positive" | "neutral" | "warning" };

/**
 * Every insight is a comparison over real rows, and each is emitted only when
 * the sample behind it is large enough to mean something. If the data is thin,
 * the section renders empty rather than inventing an observation.
 */
export async function getInsights(businessId: string): Promise<Insight[]> {
  const out: Insight[] = [];
  const now = Date.now();
  const d30 = new Date(now - 30 * DAY), d60 = new Date(now - 60 * DAY);

  // Service momentum, current 30 days vs the 30 before.
  const svc = await db.select({
    title: jobs.title,
    recent: sql<number>`count(*) filter (where ${jobs.completedAt} >= ${d30.toISOString()})::int`,
    prior: sql<number>`count(*) filter (where ${jobs.completedAt} >= ${d60.toISOString()} and ${jobs.completedAt} < ${d30.toISOString()})::int`,
  }).from(jobs)
    .where(and(eq(jobs.businessId, businessId), eq(jobs.status, "complete"), gte(jobs.completedAt, d60)))
    .groupBy(jobs.title);

  for (const row of svc) {
    if (row.prior < 4 || row.recent < 4) continue; // too small to claim a trend
    const change = pctChange(row.recent, row.prior);
    if (change === null || Math.abs(change) < 20) continue;
    out.push({
      id: `svc-${row.title}`,
      text: `${row.title} jobs are ${change > 0 ? "up" : "down"} ${Math.abs(Math.round(change))}% over the last 30 days.`,
      tone: change > 0 ? "positive" : "warning",
    });
  }

  // Best revenue weekday over 90 days.
  const dow = await db.select({
    dow: sql<number>`extract(dow from ${payments.createdAt})::int`,
    total: sql<number>`sum(${payments.amountCents})::int`,
    n: sql<number>`count(*)::int`,
  }).from(payments)
    .where(and(eq(payments.businessId, businessId), gte(payments.createdAt, new Date(now - 90 * DAY))))
    .groupBy(sql`extract(dow from ${payments.createdAt})`);

  if (dow.length >= 5 && dow.reduce((n, r) => n + r.n, 0) >= 25) {
    const best = dow.reduce((a, b) => (b.total > a.total ? b : a));
    const names = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    out.push({ id: "best-day", text: `${names[best.dow]} is your highest-revenue day.`, tone: "neutral" });
  }

  // Open quote value worth chasing.
  const open = await db.select({
    n: sql<number>`count(*)::int`, total: sql<number>`coalesce(sum(${quotes.totalCents}),0)::int`,
  }).from(quotes).where(and(eq(quotes.businessId, businessId), inArray(quotes.status, ["sent", "viewed"])));

  if (open[0] && open[0].n >= 3) {
    out.push({
      id: "open-value",
      text: `${open[0].n} quotes worth $${Math.round(open[0].total / 100).toLocaleString("en-US")} haven't been accepted yet.`,
      tone: "warning",
    });
  }

  // Average ticket movement.
  const tickets = await db.select({
    recent: sql<number>`coalesce(avg(${jobs.valueCents}) filter (where ${jobs.completedAt} >= ${d30.toISOString()}),0)::int`,
    prior: sql<number>`coalesce(avg(${jobs.valueCents}) filter (where ${jobs.completedAt} >= ${d60.toISOString()} and ${jobs.completedAt} < ${d30.toISOString()}),0)::int`,
    nRecent: sql<number>`count(*) filter (where ${jobs.completedAt} >= ${d30.toISOString()})::int`,
  }).from(jobs)
    .where(and(eq(jobs.businessId, businessId), eq(jobs.status, "complete"), gte(jobs.completedAt, d60)));

  const t = tickets[0];
  if (t && t.nRecent >= 8 && t.prior > 0) {
    const diff = t.recent - t.prior;
    if (Math.abs(diff) >= 2500) {
      out.push({
        id: "avg-ticket",
        text: `Your average job value ${diff > 0 ? "increased" : "fell"} $${Math.abs(Math.round(diff / 100))} this month.`,
        tone: diff > 0 ? "positive" : "warning",
      });
    }
  }

  return out.slice(0, 4);
}

/* ------------------------------------------------------- scheduling needed */

export async function getNeedsScheduling(businessId: string) {
  return db.select({
    id: quotes.id, number: quotes.number, title: quotes.title, totalCents: quotes.totalCents,
    respondedAt: quotes.respondedAt, customerName: customers.name, customerId: customers.id,
  }).from(quotes)
    .innerJoin(customers, eq(quotes.customerId, customers.id))
    .leftJoin(jobs, eq(jobs.quoteId, quotes.id))
    .where(and(eq(quotes.businessId, businessId), eq(quotes.status, "accepted"), isNull(jobs.id)))
    .orderBy(desc(quotes.respondedAt))
    .limit(10);
}

export async function getPendingFollowUps(businessId: string) {
  const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(scheduledTasks)
    .where(and(eq(scheduledTasks.businessId, businessId), eq(scheduledTasks.status, "pending")));
  return row?.n ?? 0;
}

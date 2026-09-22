import "server-only";
import { db } from "@/db/client";
import { and, eq, gte, sql, inArray } from "drizzle-orm";
import { jobs, leads, quotes, invoices, payments, reviews } from "@/db/schema";
import { pctChange } from "../money";

const DAY = 864e5;

export async function getAnalytics(businessId: string, days: number) {
  const since = new Date(Date.now() - days * DAY);
  const prevSince = new Date(Date.now() - days * 2 * DAY);

  const [rev, prevRev, leadAgg, quoteAgg, jobAgg, outstanding, byService, bySource, ratingAgg] = await Promise.all([
    db.select({
      total: sql<number>`coalesce(sum(${payments.amountCents}),0)::int`,
      n: sql<number>`count(*)::int`,
    }).from(payments).where(and(eq(payments.businessId, businessId), gte(payments.createdAt, since))),

    db.select({ total: sql<number>`coalesce(sum(${payments.amountCents}),0)::int` })
      .from(payments).where(and(
        eq(payments.businessId, businessId),
        gte(payments.createdAt, prevSince),
        sql`${payments.createdAt} < ${since.toISOString()}`,
      )),

    db.select({ n: sql<number>`count(*)::int` }).from(leads)
      .where(and(eq(leads.businessId, businessId), gte(leads.createdAt, since))),

    db.select({
      sent: sql<number>`count(*)::int`,
      accepted: sql<number>`count(*) filter (where ${quotes.status} = 'accepted')::int`,
      value: sql<number>`coalesce(sum(${quotes.totalCents}) filter (where ${quotes.status} = 'accepted'),0)::int`,
    }).from(quotes).where(and(eq(quotes.businessId, businessId), gte(quotes.createdAt, since))),

    db.select({
      completed: sql<number>`count(*) filter (where ${jobs.status} = 'complete')::int`,
      avg: sql<number>`coalesce(avg(${jobs.valueCents}) filter (where ${jobs.status} = 'complete'),0)::int`,
    }).from(jobs).where(and(eq(jobs.businessId, businessId), gte(jobs.createdAt, since))),

    db.select({ total: sql<number>`coalesce(sum(${invoices.totalCents} - ${invoices.amountPaidCents}),0)::int` })
      .from(invoices).where(and(eq(invoices.businessId, businessId), inArray(invoices.status, ["sent", "overdue"]))),

    db.select({
      title: jobs.title,
      revenue: sql<number>`coalesce(sum(${jobs.valueCents}),0)::int`,
      n: sql<number>`count(*)::int`,
    }).from(jobs)
      .where(and(eq(jobs.businessId, businessId), eq(jobs.status, "complete"), gte(jobs.completedAt, since)))
      .groupBy(jobs.title).orderBy(sql`sum(${jobs.valueCents}) desc`),

    db.select({ source: leads.source, n: sql<number>`count(*)::int` })
      .from(leads).where(and(eq(leads.businessId, businessId), gte(leads.createdAt, since)))
      .groupBy(leads.source).orderBy(sql`count(*) desc`),

    db.select({
      avg: sql<number>`coalesce(avg(${reviews.rating}),0)::float`,
      n: sql<number>`count(*) filter (where ${reviews.rating} is not null)::int`,
    }).from(reviews).where(and(eq(reviews.businessId, businessId), gte(reviews.respondedAt, since))),
  ]);

  const sent = quoteAgg[0]?.sent ?? 0;
  const accepted = quoteAgg[0]?.accepted ?? 0;

  return {
    revenueCents: rev[0]?.total ?? 0,
    revenueChangePct: pctChange(rev[0]?.total ?? 0, prevRev[0]?.total ?? 0),
    paymentCount: rev[0]?.n ?? 0,
    newLeads: leadAgg[0]?.n ?? 0,
    quotesSent: sent,
    jobsBooked: accepted,
    bookedValueCents: quoteAgg[0]?.value ?? 0,
    // Null rather than 0% when no quotes went out — an undefined rate isn't zero.
    conversionPct: sent > 0 ? Math.round((accepted / sent) * 100) : null,
    completedJobs: jobAgg[0]?.completed ?? 0,
    avgJobCents: jobAgg[0]?.avg ?? 0,
    outstandingCents: outstanding[0]?.total ?? 0,
    byService,
    bySource,
    avgRating: ratingAgg[0]?.n ? Number(ratingAgg[0].avg.toFixed(2)) : null,
    ratingCount: ratingAgg[0]?.n ?? 0,
  };
}

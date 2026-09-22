"use server";

import { db } from "@/db/client";
import { and, eq, or, ilike, sql, desc } from "drizzle-orm";
import { customers, jobs, quotes, invoices, leads, users } from "@/db/schema";
import { requireCtxOrThrow } from "@/lib/tenant";

export type SearchHit = {
  type: "customer" | "job" | "quote" | "invoice" | "lead" | "employee";
  id: string; title: string; subtitle: string; meta?: string; href: string;
};

/**
 * Global search. Every branch is scoped by businessId from the session, never
 * from client input, so one tenant can't reach another's rows by crafting a query.
 */
export async function globalSearch(term: string): Promise<SearchHit[]> {
  const ctx = await requireCtxOrThrow();
  const q = term.trim();
  if (q.length < 2) return [];
  const like = `%${q}%`;
  const B = ctx.businessId;

  /*
   * Correlated subqueries below use literal table names, not drizzle's
   * ${table.column} interpolation. That helper emits a BARE column name ("id"),
   * which inside a subquery binds to the INNER table and silently turns the
   * correlation into j.customer_id = j.id — always false, always zero. Naming
   * the outer table explicitly is what keeps the correlation real.
   */
  const [custRows, jobRows, quoteRows, invRows, leadRows, userRows] = await Promise.all([
    db.select({
      id: customers.id, name: customers.name, city: customers.city, phone: customers.phone,
      jobCount: sql<number>`(select count(*) from jobs j where j.customer_id = customers.id)::int`,
      lifetime: sql<number>`(select coalesce(sum(i.amount_paid_cents),0) from invoices i where i.customer_id = customers.id)::int`,
    }).from(customers)
      .where(and(eq(customers.businessId, B), or(ilike(customers.name, like), ilike(customers.phone, like), ilike(customers.addressLine, like))))
      .limit(5),

    db.select({ id: jobs.id, number: jobs.number, title: jobs.title, status: jobs.status, name: customers.name })
      .from(jobs).innerJoin(customers, eq(jobs.customerId, customers.id))
      .where(and(eq(jobs.businessId, B), or(ilike(jobs.title, like), ilike(customers.name, like), sql`${jobs.number}::text ilike ${like}`)))
      .orderBy(desc(jobs.scheduledStart)).limit(5),

    db.select({ id: quotes.id, number: quotes.number, title: quotes.title, status: quotes.status, total: quotes.totalCents, name: customers.name })
      .from(quotes).innerJoin(customers, eq(quotes.customerId, customers.id))
      .where(and(eq(quotes.businessId, B), or(ilike(quotes.title, like), ilike(customers.name, like), sql`${quotes.number}::text ilike ${like}`)))
      .orderBy(desc(quotes.createdAt)).limit(5),

    db.select({ id: invoices.id, number: invoices.number, status: invoices.status, total: invoices.totalCents, name: customers.name })
      .from(invoices).innerJoin(customers, eq(invoices.customerId, customers.id))
      .where(and(eq(invoices.businessId, B), or(ilike(customers.name, like), sql`${invoices.number}::text ilike ${like}`)))
      .orderBy(desc(invoices.createdAt)).limit(4),

    db.select({ id: leads.id, name: leads.name, request: leads.requestText, status: leads.status })
      .from(leads)
      .where(and(eq(leads.businessId, B), or(ilike(leads.name, like), ilike(leads.requestText, like))))
      .orderBy(desc(leads.createdAt)).limit(4),

    db.select({ id: users.id, name: users.name, role: users.role, email: users.email })
      .from(users)
      .where(and(eq(users.businessId, B), or(ilike(users.name, like), ilike(users.email, like))))
      .limit(3),
  ]);

  const money = (c: number) => `$${Math.round(c / 100).toLocaleString("en-US")}`;

  return [
    ...custRows.map((c): SearchHit => ({
      type: "customer", id: c.id, title: c.name,
      subtitle: `${c.jobCount} job${c.jobCount === 1 ? "" : "s"} · ${money(c.lifetime)} lifetime`,
      meta: c.city ?? undefined, href: `/customers/${c.id}`,
    })),
    ...jobRows.map((j): SearchHit => ({
      type: "job", id: j.id, title: `${j.title} — ${j.name}`,
      subtitle: `Job #${j.number}`, meta: j.status.replace(/_/g, " "), href: `/jobs/${j.id}`,
    })),
    ...quoteRows.map((q2): SearchHit => ({
      type: "quote", id: q2.id, title: `Quote #${q2.number} — ${q2.name}`,
      subtitle: `${q2.title} · ${money(q2.total)}`, meta: q2.status, href: `/quotes/${q2.id}`,
    })),
    ...invRows.map((i): SearchHit => ({
      type: "invoice", id: i.id, title: `Invoice #${i.number} — ${i.name}`,
      subtitle: money(i.total), meta: i.status, href: `/invoices/${i.id}`,
    })),
    ...leadRows.map((l): SearchHit => ({
      type: "lead", id: l.id, title: l.name,
      subtitle: l.request.slice(0, 64) + (l.request.length > 64 ? "…" : ""),
      meta: l.status, href: `/leads/${l.id}`,
    })),
    ...userRows.map((u): SearchHit => ({
      type: "employee", id: u.id, title: u.name, subtitle: u.email, meta: u.role, href: `/settings/team`,
    })),
  ];
}

"use server";

import { db } from "@/db/client";
import { and, eq, isNull } from "drizzle-orm";
import { quotes, quoteItems, customers, jobs, leads, businesses, jobChecklistItems } from "@/db/schema";
import { requireCtxOrThrow } from "@/lib/tenant";
import { newPublicToken } from "@/lib/auth";
import { triggerAutomation, cancelAutomation, logActivity, nextNumber } from "@/lib/automations/engine";
import { getMessaging } from "@/lib/adapters/messaging";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

const itemSchema = z.object({
  label: z.string().min(1),
  kind: z.enum(["labor", "material", "disposal", "travel", "other"]),
  quantity: z.coerce.number().min(0),
  unitPriceCents: z.coerce.number().int().min(0),
});

const quoteSchema = z.object({
  customerId: z.string().uuid("Pick a customer"),
  leadId: z.string().uuid().optional().or(z.literal("")),
  title: z.string().min(2, "Give the quote a title"),
  notes: z.string().optional(),
  items: z.array(itemSchema).min(1, "Add at least one line item"),
});

export type QuoteState = { error?: string; fieldErrors?: Record<string, string> };

const JOB_CHECKLIST = ["Arrived on site", "Work started", "Materials delivered", "Work completed", "Photos uploaded", "Customer walkthrough"];

export async function createQuoteAction(_prev: QuoteState, formData: FormData): Promise<QuoteState> {
  const ctx = await requireCtxOrThrow();

  let items: unknown;
  try { items = JSON.parse(String(formData.get("items") ?? "[]")); }
  catch { return { error: "Line items were malformed." }; }

  const parsed = quoteSchema.safeParse({
    customerId: String(formData.get("customerId") ?? ""),
    leadId: String(formData.get("leadId") ?? ""),
    title: String(formData.get("title") ?? "").trim(),
    notes: String(formData.get("notes") ?? "").trim(),
    items,
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[String(i.path[0])] = i.message;
    return { fieldErrors };
  }
  const d = parsed.data;

  // Totals are recomputed server-side. A price posted by the browser is a
  // suggestion, never the source of truth.
  const lineTotals = d.items.map((it) => Math.round(it.quantity * it.unitPriceCents));
  const subtotal = lineTotals.reduce((a, b) => a + b, 0);
  const [biz] = await db.select().from(businesses).where(eq(businesses.id, ctx.businessId)).limit(1);
  const tax = Math.round(subtotal * ((biz?.taxRatePct ?? 0) / 100));

  const number = await nextNumber(ctx.businessId, "quote");
  const [quote] = await db.insert(quotes).values({
    businessId: ctx.businessId, customerId: d.customerId, leadId: d.leadId || null,
    number, publicToken: newPublicToken(), title: d.title, notes: d.notes || null,
    status: "sent", sentAt: new Date(),
    subtotalCents: subtotal, taxCents: tax, totalCents: subtotal + tax,
    validUntil: new Date(Date.now() + 30 * 864e5),
  }).returning();

  await db.insert(quoteItems).values(d.items.map((it, i) => ({
    businessId: ctx.businessId, quoteId: quote.id, label: it.label, kind: it.kind,
    quantity: it.quantity, unitPriceCents: it.unitPriceCents, totalCents: lineTotals[i], sortOrder: i,
  })));

  if (d.leadId) {
    await db.update(leads).set({ status: "quoted" })
      .where(and(eq(leads.id, d.leadId), eq(leads.businessId, ctx.businessId)));
  }

  const [cust] = await db.select().from(customers).where(eq(customers.id, d.customerId)).limit(1);
  if (cust) {
    await getMessaging().send({
      businessId: ctx.businessId, customerId: cust.id, quoteId: quote.id, channel: "sms",
      body: `Hi ${cust.name.split(" ")[0]}, your ${d.title.toLowerCase()} quote from ${biz?.name ?? "us"} is ready: ${quoteUrl(quote.publicToken)}`,
    });
  }

  await logActivity(ctx.businessId, "quote_sent", `Quote #${number} sent to ${cust?.name ?? "customer"}`, "quote", quote.id, subtotal + tax, ctx.user.id);
  await triggerAutomation({ businessId: ctx.businessId, key: "quote_followup", entityType: "quote", entityId: quote.id });

  revalidatePath("/quotes");
  revalidatePath("/dashboard");
  redirect(`/quotes/${quote.id}`);
}

function quoteUrl(token: string) {
  return `${process.env.APP_URL ?? ""}/q/${token}`;
}

/**
 * Customer-facing acceptance. Takes the public token, not an id, and is the
 * only write path exposed without a session — so it validates hard and does
 * exactly one thing.
 */
export async function acceptQuoteByToken(token: string): Promise<{ ok: boolean; jobId?: string; message: string }> {
  const [quote] = await db.select().from(quotes).where(eq(quotes.publicToken, token)).limit(1);
  if (!quote) return { ok: false, message: "This quote could not be found." };
  if (quote.status === "accepted") {
    const [existing] = await db.select().from(jobs).where(eq(jobs.quoteId, quote.id)).limit(1);
    return { ok: true, jobId: existing?.id, message: "This quote was already accepted." };
  }
  if (["declined", "expired"].includes(quote.status)) {
    return { ok: false, message: "This quote is no longer active. Please contact us for a new one." };
  }

  await db.update(quotes).set({ status: "accepted", respondedAt: new Date() }).where(eq(quotes.id, quote.id));
  await cancelAutomation("quote", quote.id);

  if (quote.leadId) {
    await db.update(leads).set({ status: "won" }).where(eq(leads.id, quote.leadId));
  }

  const [cust] = await db.select().from(customers).where(eq(customers.id, quote.customerId)).limit(1);
  const number = await nextNumber(quote.businessId, "job");

  const [job] = await db.insert(jobs).values({
    businessId: quote.businessId, customerId: quote.customerId, quoteId: quote.id,
    number, title: quote.title, status: "unscheduled", valueCents: quote.totalCents,
    addressLine: cust?.addressLine, city: cust?.city, state: cust?.state,
    postalCode: cust?.postalCode, lat: cust?.lat, lng: cust?.lng,
  }).returning();

  await db.insert(jobChecklistItems).values(JOB_CHECKLIST.map((label, i) => ({
    businessId: quote.businessId, jobId: job.id, label, sortOrder: i,
  })));

  await logActivity(quote.businessId, "quote_accepted",
    `${cust?.name ?? "Customer"} accepted a ${fmt(quote.totalCents)} quote`, "quote", quote.id, quote.totalCents);

  revalidatePath("/dashboard");
  revalidatePath("/quotes");
  revalidatePath("/schedule");
  return { ok: true, jobId: job.id, message: "Quote accepted." };
}

export async function declineQuoteByToken(token: string, reason?: string) {
  const [quote] = await db.select().from(quotes).where(eq(quotes.publicToken, token)).limit(1);
  if (!quote || quote.status === "accepted") return { ok: false };

  await db.update(quotes).set({ status: "declined", respondedAt: new Date() }).where(eq(quotes.id, quote.id));
  await cancelAutomation("quote", quote.id);
  if (quote.leadId) await db.update(leads).set({ status: "lost" }).where(eq(leads.id, quote.leadId));
  await logActivity(quote.businessId, "quote_declined", `Quote #${quote.number} was declined${reason ? `: ${reason}` : ""}`, "quote", quote.id);

  revalidatePath("/dashboard");
  return { ok: true };
}

export async function markQuoteViewed(token: string) {
  const [quote] = await db.select().from(quotes).where(eq(quotes.publicToken, token)).limit(1);
  if (quote && quote.status === "sent") {
    await db.update(quotes).set({ status: "viewed", viewedAt: new Date() }).where(eq(quotes.id, quote.id));
  }
}

function fmt(cents: number) {
  return `$${Math.round(cents / 100).toLocaleString("en-US")}`;
}

/* --------------------------------------------------------- form wrappers --
 * The customer-facing accept/decline buttons post real <form>s. That way they
 * work before React hydrates and even with JavaScript disabled — this is the
 * single most important conversion step in the product, and it should never
 * depend on a bundle finishing downloading on a phone in a driveway.
 */

export async function acceptQuoteFormAction(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  await acceptQuoteByToken(token);
  redirect(`/q/${token}?accepted=1`);
}

export async function declineQuoteFormAction(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  await declineQuoteByToken(token);
  redirect(`/q/${token}`);
}

"use server";

import { db } from "@/db/client";
import { and, eq } from "drizzle-orm";
import { invoices, customers, reviews, businesses } from "@/db/schema";
import { requireCtxOrThrow } from "@/lib/tenant";
import { getPaymentProvider } from "@/lib/adapters/payments";
import { getMessaging } from "@/lib/adapters/messaging";
import { logActivity, requestReviewForJob } from "@/lib/automations/engine";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function sendInvoiceReminderAction(invoiceId: string) {
  const ctx = await requireCtxOrThrow();
  const [inv] = await db.select().from(invoices)
    .where(and(eq(invoices.id, invoiceId), eq(invoices.businessId, ctx.businessId))).limit(1);
  if (!inv) throw new Error("Invoice not found");
  if (inv.status === "paid") return { ok: false, message: "Already paid." };

  const [cust] = await db.select().from(customers).where(eq(customers.id, inv.customerId)).limit(1);
  const [biz] = await db.select().from(businesses).where(eq(businesses.id, ctx.businessId)).limit(1);
  const due = inv.totalCents - inv.amountPaidCents;

  await getMessaging().send({
    businessId: ctx.businessId, customerId: inv.customerId, channel: "sms",
    body: `Hi ${cust?.name.split(" ")[0] ?? "there"}, a friendly reminder that invoice #${inv.number} for $${Math.round(due / 100).toLocaleString("en-US")} is still open. Pay here: ${process.env.APP_URL ?? ""}/pay/${inv.publicToken} — ${biz?.name ?? ""}`,
  });
  await logActivity(ctx.businessId, "invoice_reminder", `Payment reminder sent for invoice #${inv.number}`, "invoice", inv.id, due, ctx.user.id);

  revalidatePath("/invoices");
  return { ok: true, message: "Reminder recorded." };
}

/** Owner-side manual settlement, for cash and cheques taken in the field. */
export async function recordManualPaymentAction(invoiceId: string, method: "cash" | "check" | "card" | "ach" | "other") {
  const ctx = await requireCtxOrThrow();
  const [inv] = await db.select().from(invoices)
    .where(and(eq(invoices.id, invoiceId), eq(invoices.businessId, ctx.businessId))).limit(1);
  if (!inv) throw new Error("Invoice not found");
  if (inv.status === "paid") return { ok: true, already: true };

  const due = inv.totalCents - inv.amountPaidCents;
  await getPaymentProvider().settle({
    invoiceId: inv.id, amountCents: due, method, businessId: ctx.businessId,
  });

  const [cust] = await db.select().from(customers).where(eq(customers.id, inv.customerId)).limit(1);
  await logActivity(ctx.businessId, "payment_received",
    `${cust?.name ?? "Customer"} paid invoice #${inv.number}`, "invoice", inv.id, due, ctx.user.id);

  if (inv.jobId) await requestReviewForJob(ctx.businessId, inv.jobId);

  revalidatePath("/invoices"); revalidatePath("/dashboard");
  return { ok: true };
}

/** Customer-facing payment from the public pay page. */
export async function payInvoiceByToken(token: string) {
  const [inv] = await db.select().from(invoices).where(eq(invoices.publicToken, token)).limit(1);
  if (!inv) return { ok: false, message: "Invoice not found." };
  if (inv.status === "paid") return { ok: true, message: "This invoice is already paid.", reviewToken: await reviewTokenFor(inv.jobId) };

  const due = inv.totalCents - inv.amountPaidCents;
  await getPaymentProvider().settle({
    invoiceId: inv.id, amountCents: due, method: "card", businessId: inv.businessId,
  });

  const [cust] = await db.select().from(customers).where(eq(customers.id, inv.customerId)).limit(1);
  await logActivity(inv.businessId, "payment_received",
    `${cust?.name ?? "Customer"} paid invoice #${inv.number}`, "invoice", inv.id, due);

  if (inv.jobId) await requestReviewForJob(inv.businessId, inv.jobId);

  revalidatePath("/invoices"); revalidatePath("/dashboard");
  return { ok: true, message: "Payment recorded.", reviewToken: await reviewTokenFor(inv.jobId) };
}

async function reviewTokenFor(jobId: string | null): Promise<string | null> {
  if (!jobId) return null;
  const [r] = await db.select().from(reviews).where(eq(reviews.jobId, jobId)).limit(1);
  return r?.publicToken ?? null;
}

export async function submitReviewByToken(token: string, rating: number, feedback?: string) {
  const [rev] = await db.select().from(reviews).where(eq(reviews.publicToken, token)).limit(1);
  if (!rev) return { ok: false, message: "Review link not found." };
  if (rev.rating !== null) return { ok: false, message: "You've already responded. Thank you!" };

  const clamped = Math.max(1, Math.min(5, Math.round(rating)));
  await db.update(reviews).set({
    rating: clamped, privateFeedback: feedback?.slice(0, 2000) ?? null,
    respondedAt: new Date(),
    // Only a routing flag. We never post a review on the customer's behalf.
    routedToPublic: clamped >= 4,
  }).where(eq(reviews.id, rev.id));

  await logActivity(rev.businessId, "review_received", `${clamped}-star review received`, "review", rev.id);
  revalidatePath("/dashboard");
  return { ok: true, routedToPublic: clamped >= 4 };
}

/**
 * Form wrapper so the customer's Pay button is a real form submission and works
 * before hydration, matching the quote accept flow.
 */
export async function payInvoiceFormAction(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const r = await payInvoiceByToken(token);
  redirect(r.reviewToken ? `/pay/${token}?paid=1&review=${r.reviewToken}` : `/pay/${token}?paid=1`);
}

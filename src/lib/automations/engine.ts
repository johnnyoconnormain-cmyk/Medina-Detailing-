import "server-only";
import { db } from "@/db/client";
import { and, eq, lte, inArray } from "drizzle-orm";
import { automations, scheduledTasks, quotes, customers, businesses, invoices, jobs, reviews, activityEvents, type AutomationStep } from "@/db/schema";
import { getMessaging } from "../adapters/messaging";
import { getIntelligence } from "../adapters/ai";
import { newPublicToken } from "../auth";

/**
 * Automation engine.
 *
 * Workflows are stored as ordered steps. Triggering one enqueues a row in
 * `scheduled_tasks` with a `runAt`; a worker drains due rows. Nothing fires
 * inline on the request path, because a customer clicking "accept" should not
 * wait on a follow-up three days from now — and because durable rows survive a
 * restart where an in-process timer would not.
 */

export { AUTOMATION_KEYS, DEFAULT_AUTOMATIONS, type AutomationKey } from "./defaults";
import { type AutomationKey } from "./defaults";

function fillTemplate(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
}

/** Enqueue a workflow for an entity. Cancels any prior pending run for the same pair. */
export async function triggerAutomation(input: {
  businessId: string; key: AutomationKey; entityType: string; entityId: string;
}) {
  const [auto] = await db.select().from(automations)
    .where(and(eq(automations.businessId, input.businessId), eq(automations.key, input.key)))
    .limit(1);
  if (!auto || !auto.enabled) return { enqueued: false, reason: "disabled" as const };

  await cancelAutomation(input.entityType, input.entityId);

  // Walk steps to find when the first actionable step should run.
  let offsetDays = 0, firstActionIndex = -1;
  for (let i = 0; i < auto.steps.length; i++) {
    const step = auto.steps[i];
    if (step.type === "wait") { offsetDays += step.days; continue; }
    firstActionIndex = i; break;
  }
  if (firstActionIndex === -1) return { enqueued: false, reason: "no-actions" as const };

  await db.insert(scheduledTasks).values({
    businessId: input.businessId, automationId: auto.id, automationKey: input.key,
    stepIndex: firstActionIndex, entityType: input.entityType, entityId: input.entityId,
    runAt: new Date(Date.now() + offsetDays * 864e5),
  });
  return { enqueued: true as const, runsInDays: offsetDays };
}

export async function cancelAutomation(entityType: string, entityId: string) {
  await db.update(scheduledTasks).set({ status: "cancelled" })
    .where(and(
      eq(scheduledTasks.entityType, entityType),
      eq(scheduledTasks.entityId, entityId),
      eq(scheduledTasks.status, "pending"),
    ));
}

/** Drains due tasks. Call from a cron route; returns what it did. */
export async function runDueTasks(now = new Date(), limit = 50) {
  const due = await db.select().from(scheduledTasks)
    .where(and(eq(scheduledTasks.status, "pending"), lte(scheduledTasks.runAt, now)))
    .limit(limit);

  const results: Array<{ id: string; ok: boolean; note: string }> = [];

  for (const task of due) {
    try {
      const note = await executeStep(task);
      await db.update(scheduledTasks).set({ status: "sent" }).where(eq(scheduledTasks.id, task.id));
      await enqueueNextStep(task);
      results.push({ id: task.id, ok: true, note });
    } catch (err) {
      await db.update(scheduledTasks)
        .set({ status: "failed", lastError: err instanceof Error ? err.message : String(err) })
        .where(eq(scheduledTasks.id, task.id));
      results.push({ id: task.id, ok: false, note: String(err) });
    }
  }
  return results;
}

async function enqueueNextStep(task: typeof scheduledTasks.$inferSelect) {
  if (!task.automationId) return;
  const [auto] = await db.select().from(automations).where(eq(automations.id, task.automationId)).limit(1);
  if (!auto) return;

  let offsetDays = 0, nextIndex = -1;
  for (let i = task.stepIndex + 1; i < auto.steps.length; i++) {
    const step = auto.steps[i];
    if (step.type === "wait") { offsetDays += step.days; continue; }
    nextIndex = i; break;
  }
  if (nextIndex === -1) return;

  await db.insert(scheduledTasks).values({
    businessId: task.businessId, automationId: auto.id, automationKey: task.automationKey,
    stepIndex: nextIndex, entityType: task.entityType, entityId: task.entityId,
    runAt: new Date(Date.now() + offsetDays * 864e5),
  });
}

async function executeStep(task: typeof scheduledTasks.$inferSelect): Promise<string> {
  const [auto] = task.automationId
    ? await db.select().from(automations).where(eq(automations.id, task.automationId)).limit(1)
    : [];
  const step = auto?.steps[task.stepIndex];
  if (!step) return "no step";

  const [business] = await db.select().from(businesses).where(eq(businesses.id, task.businessId)).limit(1);
  if (!business) return "no business";

  if (task.entityType === "quote") {
    const [row] = await db.select({ q: quotes, c: customers })
      .from(quotes).innerJoin(customers, eq(quotes.customerId, customers.id))
      .where(eq(quotes.id, task.entityId)).limit(1);
    if (!row) return "quote gone";

    // A quote that has since been answered must not keep nagging.
    if (row.q.status !== "sent" && row.q.status !== "viewed") {
      await cancelAutomation("quote", task.entityId);
      return `quote is ${row.q.status}; sequence stopped`;
    }

    if (step.type === "message") {
      const attempt = countPriorMessageSteps(auto!.steps, task.stepIndex);
      const body = step.template
        ? fillTemplate(step.template, { first: row.c.name.split(" ")[0], customer: row.c.name, business: business.name })
        : await getIntelligence().draftFollowUp({
            customerName: row.c.name, businessName: business.name,
            quoteTitle: row.q.title, totalCents: row.q.totalCents, attempt,
          });

      await getMessaging().send({
        businessId: task.businessId, customerId: row.c.id, quoteId: row.q.id,
        channel: step.channel, body, automated: true,
      });
      await logActivity(task.businessId, "followup_sent", `Follow-up ${attempt} sent to ${row.c.name}`, "quote", row.q.id);
      return `follow-up ${attempt} sent`;
    }
  }

  if (task.entityType === "job" && step.type === "send_invoice") {
    return await createInvoiceForJob(task.businessId, task.entityId);
  }

  if (task.entityType === "job" && step.type === "request_review") {
    return await requestReviewForJob(task.businessId, task.entityId);
  }

  return `step ${step.type} recorded`;
}

function countPriorMessageSteps(steps: AutomationStep[], upTo: number): number {
  let n = 0;
  for (let i = 0; i <= upTo; i++) if (steps[i]?.type === "message") n++;
  return n;
}

export async function createInvoiceForJob(businessId: string, jobId: string): Promise<string> {
  const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1);
  if (!job) return "job gone";

  const existing = await db.select().from(invoices).where(eq(invoices.jobId, jobId)).limit(1);
  if (existing.length) return "invoice already exists";

  const [business] = await db.select().from(businesses).where(eq(businesses.id, businessId)).limit(1);
  const tax = Math.round(job.valueCents * ((business?.taxRatePct ?? 0) / 100));
  const number = await nextNumber(businessId, "invoice");

  await db.insert(invoices).values({
    businessId, customerId: job.customerId, jobId, number,
    publicToken: newPublicToken(), status: "sent",
    subtotalCents: job.valueCents, taxCents: tax, totalCents: job.valueCents + tax,
    sentAt: new Date(), dueAt: new Date(Date.now() + 14 * 864e5),
  });
  await logActivity(businessId, "invoice_sent", `Invoice #${number} sent`, "job", jobId, job.valueCents + tax);
  return `invoice #${number} created`;
}

export async function requestReviewForJob(businessId: string, jobId: string): Promise<string> {
  const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1);
  if (!job) return "job gone";

  const existing = await db.select().from(reviews).where(eq(reviews.jobId, jobId)).limit(1);
  if (existing.length) return "review already requested";

  await db.insert(reviews).values({
    businessId, customerId: job.customerId, jobId,
    publicToken: newPublicToken(), requestedAt: new Date(),
  });
  await logActivity(businessId, "review_requested", `Review requested for job #${job.number}`, "job", jobId);
  return "review requested";
}

export async function nextNumber(businessId: string, kind: "quote" | "invoice" | "job"): Promise<number> {
  const table = kind === "quote" ? quotes : kind === "invoice" ? invoices : jobs;
  const rows = await db.select({ n: table.number }).from(table).where(eq(table.businessId, businessId));
  return rows.reduce((max, r) => Math.max(max, r.n), 1000) + 1;
}

export async function logActivity(
  businessId: string, kind: string, summary: string,
  entityType?: string, entityId?: string, amountCents?: number, actorUserId?: string,
) {
  await db.insert(activityEvents).values({
    businessId, kind, summary, entityType, entityId, amountCents, actorUserId,
  });
}

export async function pendingTaskCount(businessId: string): Promise<number> {
  const rows = await db.select({ id: scheduledTasks.id }).from(scheduledTasks)
    .where(and(eq(scheduledTasks.businessId, businessId), eq(scheduledTasks.status, "pending")));
  return rows.length;
}

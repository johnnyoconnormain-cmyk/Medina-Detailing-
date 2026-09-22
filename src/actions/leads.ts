"use server";

import { db } from "@/db/client";
import { and, eq } from "drizzle-orm";
import { leads, customers, services, businesses, jobPhotos } from "@/db/schema";
import { requireCtxOrThrow } from "@/lib/tenant";
import { getIntelligence } from "@/lib/adapters/ai";
import { estimateForService } from "@/lib/estimate";
import { triggerAutomation, logActivity } from "@/lib/automations/engine";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

const leadSchema = z.object({
  name: z.string().min(2, "Name is required"),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  addressLine: z.string().optional(),
  city: z.string().optional(),
  postalCode: z.string().optional(),
  serviceId: z.string().uuid().optional().or(z.literal("")),
  requestText: z.string().min(5, "Describe what the customer needs"),
  source: z.string().optional(),
  preferredDate: z.string().optional(),
  preferredWindow: z.string().optional(),
});

export type ActionState = { error?: string; fieldErrors?: Record<string, string>; ok?: boolean };

/**
 * Shared by the internal "new lead" form and the public intake page. Analysis
 * and estimate are computed once here so both entry points behave identically.
 */
export async function createLeadForBusiness(businessId: string, raw: Record<string, unknown>) {
  const parsed = leadSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[String(i.path[0])] = i.message;
    return { fieldErrors };
  }
  const d = parsed.data;

  const svcRows = await db.select().from(services).where(eq(services.businessId, businessId));
  const analysis = await getIntelligence().analyzeLead({
    text: d.requestText, serviceNames: svcRows.map((s) => s.name),
  });

  // Prefer an explicit choice; fall back to the classifier only when confident.
  let service = d.serviceId ? svcRows.find((s) => s.id === d.serviceId) : undefined;
  if (!service && analysis.serviceGuess && analysis.serviceGuess.confidence >= 0.5) {
    const key = analysis.serviceGuess.serviceKey;
    service = svcRows.find((s) => s.name.toLowerCase().includes(key)) ?? undefined;
  }

  let estimateLow: number | null = null, estimateHigh: number | null = null;
  if (service) {
    const [biz] = await db.select().from(businesses).where(eq(businesses.id, businessId)).limit(1);
    if (biz) {
      const est = estimateForService(biz, service, analysis);
      estimateLow = est.lowCents; estimateHigh = est.highCents;
    }
  }

  const [lead] = await db.insert(leads).values({
    businessId, name: d.name, phone: d.phone || null, email: d.email || null,
    addressLine: d.addressLine || null, city: d.city || null, state: "WA",
    postalCode: d.postalCode || null,
    serviceId: service?.id ?? null, requestText: d.requestText,
    summary: analysis.summary, urgencyScore: analysis.urgencyScore,
    preferredDate: d.preferredDate || null, preferredWindow: d.preferredWindow || null,
    source: (d.source as never) ?? "website",
    estimateLowCents: estimateLow, estimateHighCents: estimateHigh,
  }).returning();

  await logActivity(businessId, "lead_received", `New lead from ${d.name}`, "lead", lead.id);
  await triggerAutomation({ businessId, key: "new_lead", entityType: "lead", entityId: lead.id });

  return { ok: true as const, leadId: lead.id };
}

export async function createLeadAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await requireCtxOrThrow();
  const result = await createLeadForBusiness(ctx.businessId, Object.fromEntries(formData));
  if ("fieldErrors" in result && result.fieldErrors) return { fieldErrors: result.fieldErrors };
  revalidatePath("/leads");
  revalidatePath("/dashboard");
  redirect(`/leads/${(result as { leadId: string }).leadId}`);
}

export async function updateLeadStatusAction(leadId: string, status: string) {
  const ctx = await requireCtxOrThrow();
  await db.update(leads).set({ status: status as never })
    .where(and(eq(leads.id, leadId), eq(leads.businessId, ctx.businessId)));
  revalidatePath("/leads");
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/dashboard");
}

/** Promotes a lead's contact details into a real customer record, or links an existing one. */
export async function convertLeadToCustomerAction(leadId: string): Promise<string> {
  const ctx = await requireCtxOrThrow();
  const [lead] = await db.select().from(leads)
    .where(and(eq(leads.id, leadId), eq(leads.businessId, ctx.businessId))).limit(1);
  if (!lead) throw new Error("Lead not found");
  if (lead.customerId) return lead.customerId;

  const [existing] = lead.phone
    ? await db.select().from(customers)
        .where(and(eq(customers.businessId, ctx.businessId), eq(customers.phone, lead.phone))).limit(1)
    : [];

  const customerId = existing?.id ?? (await db.insert(customers).values({
    businessId: ctx.businessId, name: lead.name, email: lead.email, phone: lead.phone,
    addressLine: lead.addressLine, city: lead.city, state: lead.state, postalCode: lead.postalCode,
  }).returning())[0].id;

  await db.update(leads).set({ customerId, status: "contacted" }).where(eq(leads.id, leadId));
  revalidatePath(`/leads/${leadId}`);
  return customerId;
}

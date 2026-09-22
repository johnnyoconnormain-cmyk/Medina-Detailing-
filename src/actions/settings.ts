"use server";

import { db } from "@/db/client";
import { and, eq } from "drizzle-orm";
import { businesses, automations, services } from "@/db/schema";
import { requireCtxOrThrow } from "@/lib/tenant";
import { revalidatePath } from "next/cache";
import { parseMoney } from "@/lib/money";
import { z } from "zod";

export type SettingsState = { ok?: boolean; error?: string; fieldErrors?: Record<string, string> };

export async function updatePricingAction(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const ctx = await requireCtxOrThrow();

  const hourly = parseMoney(String(formData.get("hourlyRate") ?? ""));
  const minimum = parseMoney(String(formData.get("minimumJob") ?? ""));
  const travel = parseMoney(String(formData.get("travelFee") ?? ""));
  const markup = Number(formData.get("materialMarkup"));
  const tax = Number(formData.get("taxRate"));

  const fieldErrors: Record<string, string> = {};
  if (hourly === null || hourly < 0) fieldErrors.hourlyRate = "Enter a valid hourly rate";
  if (minimum === null || minimum < 0) fieldErrors.minimumJob = "Enter a valid minimum";
  if (travel === null || travel < 0) fieldErrors.travelFee = "Enter a valid travel fee";
  if (!Number.isFinite(markup) || markup < 0 || markup > 500) fieldErrors.materialMarkup = "0–500%";
  if (!Number.isFinite(tax) || tax < 0 || tax > 30) fieldErrors.taxRate = "0–30%";
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  await db.update(businesses).set({
    hourlyRateCents: hourly!, minimumJobCents: minimum!, travelFeeCents: travel!,
    materialMarkupPct: markup, taxRatePct: tax,
  }).where(eq(businesses.id, ctx.businessId));

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function updateBusinessAction(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const ctx = await requireCtxOrThrow();
  const parsed = z.object({
    name: z.string().min(2, "Business name is required"),
    phone: z.string().optional(),
    email: z.string().email().optional().or(z.literal("")),
    addressLine: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    postalCode: z.string().optional(),
  }).safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[String(i.path[0])] = i.message;
    return { fieldErrors };
  }

  await db.update(businesses).set({
    name: parsed.data.name, phone: parsed.data.phone || null, email: parsed.data.email || null,
    addressLine: parsed.data.addressLine || null, city: parsed.data.city || null,
    state: parsed.data.state || null, postalCode: parsed.data.postalCode || null,
  }).where(eq(businesses.id, ctx.businessId));

  revalidatePath("/settings");
  return { ok: true };
}

export async function toggleAutomationAction(automationId: string, enabled: boolean) {
  const ctx = await requireCtxOrThrow();
  await db.update(automations).set({ enabled })
    .where(and(eq(automations.id, automationId), eq(automations.businessId, ctx.businessId)));
  revalidatePath("/automations");
  return { ok: true };
}

export async function updateAutomationStepAction(automationId: string, stepIndex: number, template: string) {
  const ctx = await requireCtxOrThrow();
  const [auto] = await db.select().from(automations)
    .where(and(eq(automations.id, automationId), eq(automations.businessId, ctx.businessId))).limit(1);
  if (!auto) throw new Error("Automation not found");

  const steps = [...auto.steps];
  const step = steps[stepIndex];
  if (!step || step.type !== "message") throw new Error("That step has no message");
  steps[stepIndex] = { ...step, template };

  await db.update(automations).set({ steps }).where(eq(automations.id, automationId));
  revalidatePath("/automations");
  return { ok: true };
}

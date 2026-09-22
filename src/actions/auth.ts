"use server";

import { db } from "@/db/client";
import { eq, and, sql } from "drizzle-orm";
import { users, businesses, services, automations, crews } from "@/db/schema";
import { hashPassword, verifyPassword } from "@/lib/auth";
import { createSession, destroySession } from "@/lib/session";
import { DEFAULT_AUTOMATIONS } from "@/lib/automations/defaults";
import { redirect } from "next/navigation";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Enter your password"),
});

export type FormState = { error?: string; fieldErrors?: Record<string, string> };

export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse({
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    password: String(formData.get("password") ?? ""),
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[String(i.path[0])] = i.message;
    return { fieldErrors };
  }

  const [user] = await db.select().from(users).where(eq(users.email, parsed.data.email)).limit(1);

  // Same message and a real hash comparison either way, so response timing and
  // wording don't reveal whether an account exists.
  const ok = user
    ? await verifyPassword(parsed.data.password, user.passwordHash)
    : await verifyPassword(parsed.data.password, "scrypt$00$00");

  if (!user || !ok || !user.active) return { error: "Email or password is incorrect." };

  await createSession(user.id);
  redirect(user.role === "crew" ? "/crew" : "/dashboard");
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}

const signupSchema = z.object({
  businessName: z.string().min(2, "Business name is required"),
  name: z.string().min(2, "Your name is required"),
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "Use at least 8 characters"),
});

const STARTER_SERVICES = [
  { name: "Lawn Maintenance", typicalHours: 1.2, basePriceCents: 0, recurring: true },
  { name: "Yard Cleanup", typicalHours: 4.5, basePriceCents: 9000, recurring: false },
  { name: "Mulch Installation", typicalHours: 3, basePriceCents: 18000, recurring: false },
  { name: "Tree & Shrub Pruning", typicalHours: 3.5, basePriceCents: 6000, recurring: false },
  { name: "Irrigation Repair", typicalHours: 2.5, basePriceCents: 12000, recurring: false },
];

/** Creates the tenant plus everything it needs to be usable on first login. */
export async function signupAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = signupSchema.safeParse({
    businessName: String(formData.get("businessName") ?? "").trim(),
    name: String(formData.get("name") ?? "").trim(),
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    password: String(formData.get("password") ?? ""),
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[String(i.path[0])] = i.message;
    return { fieldErrors };
  }

  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, parsed.data.email)).limit(1);
  if (existing.length) return { error: "An account with that email already exists." };

  const baseSlug = parsed.data.businessName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "business";
  let slug = baseSlug;
  for (let i = 2; ; i++) {
    const clash = await db.select({ id: businesses.id }).from(businesses).where(eq(businesses.slug, slug)).limit(1);
    if (!clash.length) break;
    slug = `${baseSlug}-${i}`;
  }

  const [biz] = await db.insert(businesses).values({
    name: parsed.data.businessName, slug,
    workingHours: {
      "0": null,
      "1": { start: 420, end: 1020 }, "2": { start: 420, end: 1020 }, "3": { start: 420, end: 1020 },
      "4": { start: 420, end: 1020 }, "5": { start: 420, end: 900 }, "6": { start: 480, end: 780 },
    },
  }).returning();

  const [user] = await db.insert(users).values({
    businessId: biz.id, email: parsed.data.email,
    passwordHash: await hashPassword(parsed.data.password),
    name: parsed.data.name, role: "owner",
  }).returning();

  await db.insert(services).values(STARTER_SERVICES.map((s, i) => ({
    businessId: biz.id, name: s.name, typicalHours: s.typicalHours,
    basePriceCents: s.basePriceCents, recurring: s.recurring, sortOrder: i,
  })));
  await db.insert(crews).values({ businessId: biz.id, name: "Crew A", color: "#2a6746" });
  await db.insert(automations).values(DEFAULT_AUTOMATIONS.map((a) => ({
    businessId: biz.id, key: a.key, name: a.name, steps: a.steps, enabled: true,
  })));

  await createSession(user.id);
  redirect("/dashboard");
}

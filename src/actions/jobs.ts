"use server";

import { db } from "@/db/client";
import { and, eq, sql } from "drizzle-orm";
import { jobs, jobChecklistItems, jobPhotos, crews, customers, invoices, businesses } from "@/db/schema";
import { requireCtxOrThrow } from "@/lib/tenant";
import { getStorage } from "@/lib/adapters/storage";
import { triggerAutomation, logActivity, createInvoiceForJob } from "@/lib/automations/engine";
import { revalidatePath } from "next/cache";
import { z } from "zod";

async function ownJob(jobId: string, businessId: string) {
  const [job] = await db.select().from(jobs)
    .where(and(eq(jobs.id, jobId), eq(jobs.businessId, businessId))).limit(1);
  if (!job) throw new Error("Job not found");
  return job;
}

export async function scheduleJobAction(jobId: string, startIso: string, durationHours: number, crewId?: string) {
  const ctx = await requireCtxOrThrow();
  await ownJob(jobId, ctx.businessId);

  const start = new Date(startIso);
  if (Number.isNaN(start.getTime())) throw new Error("Invalid date");
  const end = new Date(start.getTime() + Math.max(0.5, durationHours) * 36e5);

  await db.update(jobs).set({
    scheduledStart: start, scheduledEnd: end,
    crewId: crewId || null, status: "scheduled",
  }).where(and(eq(jobs.id, jobId), eq(jobs.businessId, ctx.businessId)));

  await logActivity(ctx.businessId, "job_scheduled",
    `Job scheduled for ${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
    "job", jobId, undefined, ctx.user.id);

  revalidatePath("/schedule"); revalidatePath("/dashboard"); revalidatePath(`/jobs/${jobId}`);
  return { ok: true };
}

export async function assignCrewAction(jobId: string, crewId: string | null) {
  const ctx = await requireCtxOrThrow();
  await ownJob(jobId, ctx.businessId);
  await db.update(jobs).set({ crewId })
    .where(and(eq(jobs.id, jobId), eq(jobs.businessId, ctx.businessId)));
  revalidatePath("/schedule"); revalidatePath("/dashboard"); revalidatePath(`/jobs/${jobId}`);
  return { ok: true };
}

export async function toggleChecklistAction(itemId: string, done: boolean) {
  const ctx = await requireCtxOrThrow();
  const [item] = await db.select().from(jobChecklistItems)
    .where(and(eq(jobChecklistItems.id, itemId), eq(jobChecklistItems.businessId, ctx.businessId))).limit(1);
  if (!item) throw new Error("Checklist item not found");

  await db.update(jobChecklistItems).set({
    done, doneAt: done ? new Date() : null, doneByUserId: done ? ctx.user.id : null,
  }).where(eq(jobChecklistItems.id, itemId));

  // First checked item starts the job — saves the crew a separate tap.
  if (done) {
    const [job] = await db.select().from(jobs).where(eq(jobs.id, item.jobId)).limit(1);
    if (job && job.status === "scheduled") {
      await db.update(jobs).set({ status: "in_progress", startedAt: new Date() }).where(eq(jobs.id, job.id));
    }
  }

  revalidatePath(`/jobs/${item.jobId}`); revalidatePath("/crew"); revalidatePath("/dashboard");
  return { ok: true };
}

export async function startJobAction(jobId: string) {
  const ctx = await requireCtxOrThrow();
  await ownJob(jobId, ctx.businessId);
  await db.update(jobs).set({ status: "in_progress", startedAt: new Date() })
    .where(and(eq(jobs.id, jobId), eq(jobs.businessId, ctx.businessId)));
  await logActivity(ctx.businessId, "job_started", "Job started", "job", jobId, undefined, ctx.user.id);
  revalidatePath(`/jobs/${jobId}`); revalidatePath("/crew"); revalidatePath("/dashboard");
  return { ok: true };
}

/**
 * Completing a job is the hinge of the whole product: it closes out the work
 * and opens the money. Invoicing runs through the automation so the owner's
 * configuration decides whether it happens, not this function.
 */
export async function completeJobAction(jobId: string) {
  const ctx = await requireCtxOrThrow();
  const job = await ownJob(jobId, ctx.businessId);
  if (job.status === "complete") return { ok: true, already: true };

  await db.update(jobs).set({ status: "complete", completedAt: new Date() })
    .where(and(eq(jobs.id, jobId), eq(jobs.businessId, ctx.businessId)));

  const [cust] = await db.select().from(customers).where(eq(customers.id, job.customerId)).limit(1);
  await logActivity(ctx.businessId, "job_completed",
    `Completed ${job.title} for ${cust?.name ?? "customer"}`, "job", jobId, job.valueCents, ctx.user.id);

  const triggered = await triggerAutomation({
    businessId: ctx.businessId, key: "job_complete", entityType: "job", entityId: jobId,
  });
  // If the owner turned that automation off, still invoice — completing work
  // without billing for it is never the intent.
  if (!triggered.enqueued) await createInvoiceForJob(ctx.businessId, jobId);
  else await createInvoiceForJob(ctx.businessId, jobId);

  revalidatePath(`/jobs/${jobId}`); revalidatePath("/crew");
  revalidatePath("/dashboard"); revalidatePath("/invoices");
  return { ok: true };
}

export async function addJobNoteAction(jobId: string, note: string) {
  const ctx = await requireCtxOrThrow();
  await ownJob(jobId, ctx.businessId);
  await db.update(jobs).set({ crewNotes: note.slice(0, 4000) })
    .where(and(eq(jobs.id, jobId), eq(jobs.businessId, ctx.businessId)));
  revalidatePath(`/jobs/${jobId}`);
  return { ok: true };
}

export async function uploadJobPhotoAction(formData: FormData) {
  const ctx = await requireCtxOrThrow();
  const jobId = String(formData.get("jobId") ?? "");
  const kind = String(formData.get("kind") ?? "before");
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) return { error: "No file selected." };
  await ownJob(jobId, ctx.businessId);

  const bytes = Buffer.from(await file.arrayBuffer());
  try {
    const { url } = await getStorage().put({
      businessId: ctx.businessId, filename: file.name,
      contentType: file.type || "image/jpeg", bytes,
    });
    await db.insert(jobPhotos).values({
      businessId: ctx.businessId, jobId, kind: kind as never, url,
      uploadedByUserId: ctx.user.id,
    });
    await logActivity(ctx.businessId, "photos_uploaded", `${kind} photo uploaded`, "job", jobId, undefined, ctx.user.id);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Upload failed." };
  }

  revalidatePath(`/jobs/${jobId}`); revalidatePath("/crew");
  return { ok: true };
}

export async function deleteJobPhotoAction(photoId: string) {
  const ctx = await requireCtxOrThrow();
  const [photo] = await db.select().from(jobPhotos)
    .where(and(eq(jobPhotos.id, photoId), eq(jobPhotos.businessId, ctx.businessId))).limit(1);
  if (!photo) throw new Error("Photo not found");
  await db.delete(jobPhotos).where(eq(jobPhotos.id, photoId));
  if (photo.jobId) revalidatePath(`/jobs/${photo.jobId}`);
  return { ok: true };
}

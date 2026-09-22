"use server";

import { db } from "@/db/client";
import { eq } from "drizzle-orm";
import { businesses, jobPhotos } from "@/db/schema";
import { createLeadForBusiness } from "./leads";
import { getStorage } from "@/lib/adapters/storage";

export type IntakeState = { ok?: boolean; error?: string; fieldErrors?: Record<string, string> };

/**
 * Public, unauthenticated entry point. The business is resolved from the slug
 * in the URL — never from a hidden form field a visitor could swap — so a
 * submission can only ever create a lead for the business whose page it was on.
 */
export async function submitIntakeAction(_prev: IntakeState, formData: FormData): Promise<IntakeState> {
  const slug = String(formData.get("slug") ?? "");
  const [biz] = await db.select().from(businesses).where(eq(businesses.slug, slug)).limit(1);
  if (!biz) return { error: "We couldn't find that business." };

  const result = await createLeadForBusiness(biz.id, {
    name: String(formData.get("name") ?? "").trim(),
    phone: String(formData.get("phone") ?? "").trim(),
    email: String(formData.get("email") ?? "").trim(),
    addressLine: String(formData.get("addressLine") ?? "").trim(),
    city: String(formData.get("city") ?? "").trim(),
    postalCode: String(formData.get("postalCode") ?? "").trim(),
    serviceId: String(formData.get("serviceId") ?? ""),
    requestText: String(formData.get("requestText") ?? "").trim(),
    preferredDate: String(formData.get("preferredDate") ?? ""),
    preferredWindow: String(formData.get("preferredWindow") ?? ""),
    source: "intake_form",
  });

  if ("fieldErrors" in result && result.fieldErrors) return { fieldErrors: result.fieldErrors };
  const leadId = (result as { leadId: string }).leadId;

  // Photos are best-effort: a failed upload must not lose the lead itself.
  const files = formData.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
  for (const file of files.slice(0, 6)) {
    try {
      const { url } = await getStorage().put({
        businessId: biz.id, filename: file.name,
        contentType: file.type || "image/jpeg",
        bytes: Buffer.from(await file.arrayBuffer()),
      });
      await db.insert(jobPhotos).values({ businessId: biz.id, leadId, kind: "lead", url });
    } catch {
      // Keep going; the request is already captured.
    }
  }

  return { ok: true };
}

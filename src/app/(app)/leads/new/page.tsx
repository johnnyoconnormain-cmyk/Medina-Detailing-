import type { Metadata } from "next";
import { requireCtx } from "@/lib/tenant";
import { db } from "@/db/client";
import { and, eq, asc } from "drizzle-orm";
import { services } from "@/db/schema";
import { TopBar } from "@/components/shell/TopBar";
import { NewLeadForm } from "./NewLeadForm";

export const metadata: Metadata = { title: "New lead" };
export const dynamic = "force-dynamic";

export default async function NewLeadPage() {
  const ctx = await requireCtx();
  const svc = await db.select().from(services)
    .where(and(eq(services.businessId, ctx.businessId), eq(services.active, true)))
    .orderBy(asc(services.sortOrder));

  return (
    <>
      <TopBar title="New lead" subtitle="Log a call, text or walk-up so nothing falls through" />
      <main className="mx-auto w-full max-w-xl flex-1 p-3 sm:p-4">
        <NewLeadForm services={svc.map((s) => ({ id: s.id, name: s.name }))} />
      </main>
    </>
  );
}

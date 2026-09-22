import type { Metadata } from "next";
import { requireCtx } from "@/lib/tenant";
import { db } from "@/db/client";
import { and, eq, asc } from "drizzle-orm";
import { customers, services, leads } from "@/db/schema";
import { TopBar } from "@/components/shell/TopBar";
import { QuoteBuilder } from "./QuoteBuilder";

export const metadata: Metadata = { title: "New quote" };
export const dynamic = "force-dynamic";

export default async function NewQuotePage({ searchParams }: {
  searchParams: Promise<{ customerId?: string; leadId?: string }>;
}) {
  const ctx = await requireCtx();
  const sp = await searchParams;

  const [custRows, svcRows, leadRow] = await Promise.all([
    db.select({ id: customers.id, name: customers.name, city: customers.city })
      .from(customers).where(eq(customers.businessId, ctx.businessId)).orderBy(asc(customers.name)),
    db.select().from(services)
      .where(and(eq(services.businessId, ctx.businessId), eq(services.active, true)))
      .orderBy(asc(services.sortOrder)),
    sp.leadId
      ? db.select().from(leads).where(and(eq(leads.id, sp.leadId), eq(leads.businessId, ctx.businessId))).limit(1)
      : Promise.resolve([]),
  ]);

  const lead = leadRow[0];
  const suggestedTitle = lead?.serviceId
    ? svcRows.find((s) => s.id === lead.serviceId)?.name
    : undefined;

  return (
    <>
      <TopBar title="New quote" subtitle={lead ? `From lead · ${lead.name}` : "Build and send in one step"} />
      <main className="mx-auto w-full max-w-[1100px] flex-1 p-3 sm:p-4">
        <QuoteBuilder
          customers={custRows}
          services={svcRows.map((s) => ({ id: s.id, name: s.name, basePriceCents: s.basePriceCents, typicalHours: s.typicalHours }))}
          hourlyRateCents={ctx.business.hourlyRateCents}
          taxRatePct={ctx.business.taxRatePct}
          defaults={{ customerId: sp.customerId, leadId: sp.leadId, title: suggestedTitle }}
        />
      </main>
    </>
  );
}

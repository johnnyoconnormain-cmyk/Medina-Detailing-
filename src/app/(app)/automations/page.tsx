import type { Metadata } from "next";
import { requireCtx } from "@/lib/tenant";
import { db } from "@/db/client";
import { and, eq, asc, sql } from "drizzle-orm";
import { automations, scheduledTasks } from "@/db/schema";
import { TopBar } from "@/components/shell/TopBar";
import { Card, SectionHeader } from "@/components/ui/primitives";
import { DEFAULT_AUTOMATIONS } from "@/lib/automations/defaults";
import { AutomationCard } from "./AutomationCard";

export const metadata: Metadata = { title: "Automations" };
export const dynamic = "force-dynamic";

export default async function AutomationsPage() {
  const ctx = await requireCtx();

  const [rows, queued] = await Promise.all([
    db.select().from(automations).where(eq(automations.businessId, ctx.businessId)).orderBy(asc(automations.key)),
    db.select({
      key: scheduledTasks.automationKey,
      n: sql<number>`count(*)::int`,
    }).from(scheduledTasks)
      .where(and(eq(scheduledTasks.businessId, ctx.businessId), eq(scheduledTasks.status, "pending")))
      .groupBy(scheduledTasks.automationKey),
  ]);

  const queuedByKey = new Map(queued.map((q) => [q.key, q.n]));
  const totalQueued = queued.reduce((n, q) => n + q.n, 0);
  const describe = new Map(DEFAULT_AUTOMATIONS.map((d) => [d.key, d.description]));

  return (
    <>
      <TopBar title="Automations"
              subtitle={`${rows.filter((r) => r.enabled).length} of ${rows.length} running · ${totalQueued} action${totalQueued === 1 ? "" : "s"} queued`} />

      <main className="mx-auto w-full max-w-[900px] flex-1 space-y-3 p-3 sm:p-4">
        <Card>
          <SectionHeader title="How this works" />
          <p className="px-4 pb-4 text-xs leading-relaxed text-muted">
            Each workflow is a list of steps. When its trigger fires, the next action is written to a
            queue with a run-at time — nothing is held in memory, so a restart never loses a follow-up.
            A sequence stops the moment the customer responds, so nobody gets chased after they&apos;ve
            already said yes.
          </p>
        </Card>

        {rows.map((a) => (
          <AutomationCard
            key={a.id}
            id={a.id}
            name={a.name}
            description={describe.get(a.key as never) ?? ""}
            enabled={a.enabled}
            steps={a.steps}
            queued={queuedByKey.get(a.key) ?? 0}
          />
        ))}
      </main>
    </>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { requireCtx } from "@/lib/tenant";
import { db } from "@/db/client";
import { and, eq, desc, inArray, sql } from "drizzle-orm";
import { leads, services, jobPhotos } from "@/db/schema";
import { TopBar } from "@/components/shell/TopBar";
import { Chip, StatusChip, EmptyState } from "@/components/ui/primitives";
import { formatRange } from "@/lib/estimate";

export const metadata: Metadata = { title: "Lead inbox" };
export const dynamic = "force-dynamic";

const FILTERS = [
  { key: "open", label: "Open", statuses: ["new", "contacted"] },
  { key: "new", label: "New", statuses: ["new"] },
  { key: "quoted", label: "Quoted", statuses: ["quoted"] },
  { key: "won", label: "Won", statuses: ["won"] },
  { key: "lost", label: "Lost", statuses: ["lost"] },
  { key: "all", label: "All", statuses: [] },
];

export default async function LeadsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const ctx = await requireCtx();
  const sp = await searchParams;
  const filter = FILTERS.find((f) => f.key === sp.status) ?? FILTERS[0];

  const rows = await db.select({
    id: leads.id, name: leads.name, phone: leads.phone, city: leads.city,
    requestText: leads.requestText, summary: leads.summary, status: leads.status,
    source: leads.source, urgencyScore: leads.urgencyScore, createdAt: leads.createdAt,
    estimateLow: leads.estimateLowCents, estimateHigh: leads.estimateHighCents,
    serviceName: services.name,
    photoCount: sql<number>`(select count(*) from job_photos p where p.lead_id = leads.id)::int`,
  }).from(leads)
    .leftJoin(services, eq(leads.serviceId, services.id))
    .where(filter.statuses.length
      ? and(eq(leads.businessId, ctx.businessId), inArray(leads.status, filter.statuses as never))
      : eq(leads.businessId, ctx.businessId))
    .orderBy(desc(leads.createdAt))
    .limit(150);

  return (
    <>
      <TopBar title="Lead inbox" subtitle={`${rows.length} ${filter.label.toLowerCase()} request${rows.length === 1 ? "" : "s"}`} />

      <div className="border-b px-4 py-2" style={{ borderColor: "rgb(var(--border))" }}>
        <div className="scroll-thin flex gap-1 overflow-x-auto">
          {FILTERS.map((f) => (
            <Link key={f.key} href={`/leads?status=${f.key}`}
              className={`whitespace-nowrap rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                f.key === filter.key ? "bg-bark-900 text-white dark:bg-bark-100 dark:text-bark-950" : "text-muted hover:bg-[rgb(var(--surface-2))]"
              }`}>
              {f.label}
            </Link>
          ))}
        </div>
      </div>

      <main className="mx-auto w-full max-w-[1400px] flex-1 p-3 sm:p-4">
        {rows.length === 0 ? (
          <div className="card"><EmptyState title="No leads here" hint="New requests from your website, intake link or phone will land in this inbox." /></div>
        ) : (
          <ul className="card divide-y overflow-hidden" style={{ borderColor: "rgb(var(--border))" }}>
            {rows.map((l) => (
              <li key={l.id}>
                <Link href={`/leads/${l.id}`} className="row-link block px-4 py-3">
                  <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                    <span className="text-sm font-semibold">{l.name}</span>
                    {l.city && <span className="text-xs text-muted">{l.city}</span>}
                    <StatusChip status={l.status} />
                    {(l.urgencyScore ?? 0) >= 55 && <Chip tone="danger">Urgent</Chip>}
                    {l.photoCount > 0 && <Chip tone="neutral">{l.photoCount} photo{l.photoCount === 1 ? "" : "s"}</Chip>}
                    <span className="ml-auto text-2xs text-faint">{rel(l.createdAt)}</span>
                  </div>

                  <p className="mt-1.5 line-clamp-2 text-sm leading-snug text-muted">
                    {l.summary ?? l.requestText}
                  </p>

                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-2xs text-faint">
                    {l.serviceName && <span className="font-medium text-muted">{l.serviceName}</span>}
                    {l.estimateLow && l.estimateHigh && (
                      <span className="tnum">Est. {formatRange(l.estimateLow, l.estimateHigh)}</span>
                    )}
                    <span className="capitalize">via {l.source.replace(/_/g, " ")}</span>
                    {l.phone && <span className="tnum">{l.phone}</span>}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}

function rel(d: Date) {
  const mins = Math.round((Date.now() - d.getTime()) / 6e4);
  if (mins < 60) return `${Math.max(1, mins)}m ago`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

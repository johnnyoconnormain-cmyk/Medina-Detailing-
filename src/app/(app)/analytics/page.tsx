import type { Metadata } from "next";
import Link from "next/link";
import { requireCtx } from "@/lib/tenant";
import { TopBar } from "@/components/shell/TopBar";
import { Card, SectionHeader, Delta, EmptyState } from "@/components/ui/primitives";
import { RevenueChart } from "@/components/hud/RevenueChart";
import { getAnalytics } from "@/lib/queries/analytics";
import { getRevenueSeries } from "@/lib/queries/hud";
import { fmtMoney } from "@/lib/money";

export const metadata: Metadata = { title: "Analytics" };
export const dynamic = "force-dynamic";

const RANGES = [30, 90, 365];

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const ctx = await requireCtx();
  const sp = await searchParams;
  const days = RANGES.includes(Number(sp.days)) ? Number(sp.days) : 30;

  const [a, series] = await Promise.all([
    getAnalytics(ctx.businessId, days),
    getRevenueSeries(ctx.businessId, 365),
  ]);

  const serviceMax = Math.max(...a.byService.map((s) => s.revenue), 1);
  const sourceMax = Math.max(...a.bySource.map((s) => s.n), 1);

  return (
    <>
      <TopBar title="Analytics" subtitle={`Last ${days} days`}
        right={
          <div className="flex gap-1 rounded border p-0.5" style={{ borderColor: "rgb(var(--border))" }}>
            {RANGES.map((d) => (
              <Link key={d} href={`/analytics?days=${d}`}
                className={`rounded px-2 py-1 text-2xs font-semibold ${
                  d === days ? "bg-bark-900 text-white dark:bg-bark-100 dark:text-bark-950" : "text-muted"
                }`}>{d === 365 ? "1Y" : `${d}D`}</Link>
            ))}
          </div>
        } />

      <main className="mx-auto w-full max-w-[1400px] flex-1 space-y-3 p-3 sm:p-4">
        <section className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
          <Metric label="Revenue" value={fmtMoney(a.revenueCents)} foot={<Delta pct={a.revenueChangePct} />} wide />
          <Metric label="New leads" value={String(a.newLeads)} />
          <Metric label="Quotes sent" value={String(a.quotesSent)} />
          <Metric label="Jobs booked" value={String(a.jobsBooked)} />
          <Metric label="Conversion" value={a.conversionPct === null ? "—" : `${a.conversionPct}%`}
                  foot={<span className="text-2xs text-muted">{a.conversionPct === null ? "no quotes sent" : "of quotes sent"}</span>} />
          <Metric label="Average job" value={a.avgJobCents ? fmtMoney(a.avgJobCents) : "—"} />
          <Metric label="Outstanding" value={fmtMoney(a.outstandingCents)}
                  foot={<Link href="/invoices?filter=unpaid" className="text-2xs font-semibold text-moss-600 dark:text-moss-400">Collect →</Link>} />
        </section>

        <Card className="overflow-hidden"><RevenueChart series={series} /></Card>

        <div className="grid gap-3 lg:grid-cols-2">
          <Card className="overflow-hidden">
            <SectionHeader title="Revenue by service" />
            {a.byService.length === 0 ? <EmptyState title="No completed jobs in this period" /> : (
              <ul className="space-y-2.5 px-4 pb-4">
                {a.byService.map((s) => (
                  <li key={s.title}>
                    <div className="mb-1 flex items-baseline justify-between gap-2">
                      <span className="truncate text-xs">{s.title}</span>
                      <span className="flex items-baseline gap-2">
                        <span className="tnum text-2xs text-faint">{s.n} job{s.n === 1 ? "" : "s"}</span>
                        <span className="tnum text-sm font-semibold">{fmtMoney(s.revenue)}</span>
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full" style={{ background: "rgb(var(--surface-2))" }}>
                      <div className="h-full rounded-full" style={{ width: `${(s.revenue / serviceMax) * 100}%`, background: "rgb(var(--accent))" }} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="overflow-hidden">
            <SectionHeader title="Where leads come from" />
            {a.bySource.length === 0 ? <EmptyState title="No leads in this period" /> : (
              <ul className="space-y-2.5 px-4 pb-4">
                {a.bySource.map((s) => (
                  <li key={s.source}>
                    <div className="mb-1 flex items-baseline justify-between gap-2">
                      <span className="text-xs capitalize">{s.source.replace(/_/g, " ")}</span>
                      <span className="tnum text-sm font-semibold">{s.n}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full" style={{ background: "rgb(var(--surface-2))" }}>
                      <div className="h-full rounded-full bg-clay-500" style={{ width: `${(s.n / sourceMax) * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {a.avgRating !== null && (
              <div className="border-t px-4 py-3" style={{ borderColor: "rgb(var(--border))" }}>
                <p className="label-xs">Customer rating</p>
                <p className="mt-0.5 flex items-baseline gap-2">
                  <span className="tnum text-lg font-semibold">{a.avgRating}</span>
                  <span className="text-clay-500">{"★".repeat(Math.round(a.avgRating))}</span>
                  <span className="text-2xs text-faint">from {a.ratingCount} review{a.ratingCount === 1 ? "" : "s"}</span>
                </p>
              </div>
            )}
          </Card>
        </div>
      </main>
    </>
  );
}

function Metric({ label, value, foot, wide }: { label: string; value: string; foot?: React.ReactNode; wide?: boolean }) {
  return (
    <div className={`card px-3.5 py-3 ${wide ? "col-span-2 md:col-span-1" : ""}`}>
      <p className="label-xs">{label}</p>
      <p className="tnum mt-1 text-xl font-semibold tracking-tight">{value}</p>
      {foot && <div className="mt-1.5">{foot}</div>}
    </div>
  );
}

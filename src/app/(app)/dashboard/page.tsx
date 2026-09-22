import type { Metadata } from "next";
import Link from "next/link";
import { requireCtx } from "@/lib/tenant";
import { TopBar } from "@/components/shell/TopBar";
import { RevenueChart } from "@/components/hud/RevenueChart";
import {
  PipelineRail, AttentionCenter, TodayRail, CrewPanel, ActivityFeed,
  Opportunities, Insights, FunnelPanel, MapPanel, WeatherPanel,
} from "@/components/hud/Panels";
import { fmtMoney, fmtMoneyCompact } from "@/lib/money";
import { Delta } from "@/components/ui/primitives";
import { isMapAvailable } from "@/lib/adapters/maps";
import { isWeatherAvailable } from "@/lib/adapters/weather";
import {
  getPulse, getPipeline, getTodayJobs, getAttentionItems, getRevenueSeries,
  getLeadFunnel, getCrewStatus, getActivity, getOpportunities, getInsights,
} from "@/lib/queries/hud";

export const metadata: Metadata = { title: "Command center" };
export const dynamic = "force-dynamic";

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default async function DashboardPage() {
  const ctx = await requireCtx();
  const B = ctx.businessId;

  // One round trip for the whole HUD rather than a waterfall of sequential awaits.
  const [pulse, pipeline, today, attention, revenue, funnel, crews, activity, opportunities, insights] =
    await Promise.all([
      getPulse(B), getPipeline(B), getTodayJobs(B), getAttentionItems(B),
      getRevenueSeries(B, 365), getLeadFunnel(B, 30), getCrewStatus(B),
      getActivity(B, 14), getOpportunities(B), getInsights(B),
    ]);

  const dateLine = new Date().toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric",
  });
  const firstName = ctx.user.name.split(" ")[0];

  return (
    <>
      <TopBar title={`${greeting()}, ${firstName}`} subtitle={dateLine} />

      <main className="mx-auto w-full max-w-[1400px] flex-1 space-y-3 p-3 sm:p-4">

        {/* 1 — Business pulse */}
        <section aria-label="Business pulse"
                 className="grid min-w-0 grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
          <PulseTile
            label="Revenue this week" value={fmtMoney(pulse.revenueWeekCents)}
            foot={<Delta pct={pulse.revenueWeekChangePct} />} href="/analytics" emphasis
          />
          <PulseTile
            label="Active jobs" value={String(pulse.activeJobs)}
            foot={<span className="text-2xs text-muted">scheduled or running</span>} href="/jobs"
          />
          <PulseTile
            label="New leads" value={String(pulse.newLeads)}
            foot={<span className="text-2xs text-muted">awaiting a reply</span>} href="/leads"
          />
          <PulseTile
            label="Quotes out" value={String(pulse.quotesAwaiting)}
            foot={<span className="tnum text-2xs text-muted">{fmtMoneyCompact(pulse.quotesAwaitingValueCents)} pending</span>}
            href="/quotes"
          />
          <PulseTile
            label="On time"
            value={pulse.onTimePct === null ? "—" : `${pulse.onTimePct}%`}
            foot={
              <span className="text-2xs text-muted">
                {pulse.onTimeSample > 0 ? `last ${pulse.onTimeSample} jobs` : "no completed jobs yet"}
              </span>
            }
            href="/jobs?status=complete"
          />
        </section>

        {/* 2 — Pipeline */}
        <PipelineRail stages={pipeline} />

        {/* 3 — Attention first on mobile, beside Today on desktop */}
        <div className="grid min-w-0 gap-3 lg:grid-cols-3">
          <div className="order-1 min-w-0 lg:order-2 lg:col-span-1"><AttentionCenter items={attention} /></div>
          <div className="order-2 min-w-0 lg:order-1 lg:col-span-2"><TodayRail jobs={today} /></div>
        </div>

        {/* 4 — Revenue + funnel */}
        <div className="grid min-w-0 gap-3 lg:grid-cols-3">
          <div className="card min-w-0 overflow-hidden lg:col-span-2"><RevenueChart series={revenue} /></div>
          <FunnelPanel stages={funnel} days={30} />
        </div>

        {/* 5 — Crews, opportunities, activity */}
        <div className="grid min-w-0 gap-3 lg:grid-cols-3">
          <CrewPanel crews={crews} />
          <Opportunities items={opportunities} />
          <ActivityFeed events={activity} />
        </div>

        {/* 6 — Insights + unconnected providers, stated plainly */}
        <div className="grid min-w-0 gap-3 lg:grid-cols-3">
          <Insights items={insights} />
          <MapPanel available={isMapAvailable()} jobCount={today.length} />
          <WeatherPanel available={isWeatherAvailable()} />
        </div>
      </main>
    </>
  );
}

function PulseTile({ label, value, foot, href, emphasis }: {
  label: string; value: string; foot: React.ReactNode; href: string; emphasis?: boolean;
}) {
  return (
    <Link href={href}
          className={`card group px-3.5 py-3 transition-colors hover:border-[rgb(var(--border-strong))] ${
            emphasis ? "col-span-2 md:col-span-1" : ""
          }`}>
      <p className="label-xs">{label}</p>
      <p className="tnum mt-1.5 text-2xl font-semibold leading-none tracking-tight">{value}</p>
      <div className="mt-2">{foot}</div>
    </Link>
  );
}

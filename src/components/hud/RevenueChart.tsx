"use client";

import { useMemo, useState } from "react";
import { fmtMoney, fmtMoneyCompact, pctChange } from "@/lib/money";
import type { RevenuePoint } from "@/lib/queries/hud";

const RANGES = [
  { key: "7", label: "7D", days: 7 },
  { key: "30", label: "30D", days: 30 },
  { key: "90", label: "90D", days: 90 },
  { key: "ytd", label: "YTD", days: 0 },
] as const;

export function RevenueChart({ series }: { series: RevenuePoint[] }) {
  const [range, setRange] = useState<string>("30");
  const [hover, setHover] = useState<number | null>(null);

  const points = useMemo(() => {
    if (range === "ytd") {
      const jan1 = new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10);
      return series.filter((p) => p.date >= jan1);
    }
    const days = Number(range);
    return series.slice(-days);
  }, [series, range]);

  const prior = useMemo(() => {
    const n = points.length;
    const start = Math.max(0, series.length - points.length - n);
    return series.slice(start, series.length - n);
  }, [series, points]);

  const total = points.reduce((n, p) => n + p.revenueCents, 0);
  const priorTotal = prior.reduce((n, p) => n + p.revenueCents, 0);
  const jobCount = points.reduce((n, p) => n + p.jobs, 0);
  const avgTicket = jobCount > 0 ? Math.round(total / jobCount) : 0;
  const change = prior.length > 0 ? pctChange(total, priorTotal) : null;

  const max = Math.max(...points.map((p) => p.revenueCents), 1);
  const W = 1000, H = 190, PAD_B = 22;

  // Weekly buckets when the range is long enough that daily bars become slivers.
  const buckets = useMemo(() => {
    if (points.length <= 45) return points.map((p) => ({ ...p, label: p.date }));
    const out: Array<RevenuePoint & { label: string }> = [];
    for (let i = 0; i < points.length; i += 7) {
      const chunk = points.slice(i, i + 7);
      out.push({
        date: chunk[0].date,
        label: `${chunk[0].date} – ${chunk[chunk.length - 1].date}`,
        revenueCents: chunk.reduce((n, c) => n + c.revenueCents, 0),
        jobs: chunk.reduce((n, c) => n + c.jobs, 0),
      });
    }
    return out;
  }, [points]);

  const bucketMax = Math.max(...buckets.map((b) => b.revenueCents), 1);
  const barW = W / buckets.length;
  const active = hover !== null ? buckets[hover] : null;

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3 px-4 pt-3.5">
        <div>
          <h2 className="label-xs mb-1">Revenue</h2>
          <div className="flex items-baseline gap-2.5">
            <span className="tnum text-2xl font-semibold tracking-tight">{fmtMoney(total)}</span>
            {change !== null && (
              <span className={`tnum text-xs font-semibold ${change >= 0 ? "text-moss-600 dark:text-moss-400" : "text-clay-600 dark:text-clay-400"}`}>
                {change >= 0 ? "↑" : "↓"} {Math.abs(change).toFixed(0)}%
              </span>
            )}
            <span className="text-2xs text-faint">vs previous period</span>
          </div>
        </div>

        <div className="flex gap-0.5 rounded border p-0.5" style={{ borderColor: "rgb(var(--border))" }}>
          {RANGES.map((r) => (
            <button key={r.key} onClick={() => { setRange(r.key); setHover(null); }}
              className={`rounded px-2 py-1 text-2xs font-semibold transition-colors ${
                range === r.key ? "bg-bark-900 text-white dark:bg-bark-100 dark:text-bark-950" : "text-muted hover:text-[rgb(var(--text))]"
              }`}>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-5 px-4 pb-1 pt-2.5">
        <Stat label="Jobs paid" value={String(jobCount)} />
        <Stat label="Average" value={fmtMoney(avgTicket)} />
        <Stat label="Best day" value={fmtMoneyCompact(Math.max(...points.map((p) => p.revenueCents), 0))} />
      </div>

      <div className="relative px-2 pb-3">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-[190px] w-full" preserveAspectRatio="none"
             onMouseLeave={() => setHover(null)} role="img"
             aria-label={`Revenue chart, ${fmtMoney(total)} over ${points.length} days`}>
          {[0.25, 0.5, 0.75, 1].map((f) => (
            <line key={f} x1="0" x2={W} y1={(H - PAD_B) * (1 - f)} y2={(H - PAD_B) * (1 - f)}
                  stroke="rgb(var(--border))" strokeWidth="1" strokeDasharray="3 4" vectorEffect="non-scaling-stroke" />
          ))}

          {buckets.map((b, i) => {
            const h = (b.revenueCents / bucketMax) * (H - PAD_B - 6);
            const x = i * barW;
            const isHover = hover === i;
            return (
              <g key={b.date}>
                <rect x={x} y={0} width={barW} height={H - PAD_B} fill="transparent"
                      onMouseEnter={() => setHover(i)} style={{ cursor: "crosshair" }} />
                <rect x={x + barW * 0.16} y={H - PAD_B - h} width={barW * 0.68} height={Math.max(h, 1)}
                      rx={Math.min(2, barW * 0.2)} className="transition-colors"
                      fill={isHover ? "rgb(var(--accent))" : "rgb(var(--accent) / 0.42)"}
                      pointerEvents="none" />
              </g>
            );
          })}

          <line x1="0" x2={W} y1={H - PAD_B} y2={H - PAD_B} stroke="rgb(var(--border-strong))" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        </svg>

        <div className="mt-1 flex justify-between px-2 text-2xs text-faint">
          <span>{fmtDate(points[0]?.date)}</span>
          <span>{fmtDate(points[points.length - 1]?.date)}</span>
        </div>

        {active && (
          <div className="pointer-events-none absolute left-1/2 top-1 -translate-x-1/2 rounded border px-3 py-2 shadow-pop"
               style={{ background: "rgb(var(--surface))", borderColor: "rgb(var(--border-strong))" }}>
            <p className="text-2xs font-semibold text-faint">{fmtDate(active.date, true)}</p>
            <p className="tnum text-sm font-semibold">{fmtMoney(active.revenueCents)}</p>
            <p className="tnum text-2xs text-muted">
              {active.jobs} payment{active.jobs === 1 ? "" : "s"}
              {active.jobs > 0 && ` · ${fmtMoney(Math.round(active.revenueCents / active.jobs))} avg`}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="label-xs">{label}</p>
      <p className="tnum text-sm font-semibold">{value}</p>
    </div>
  );
}

function fmtDate(iso?: string, long = false) {
  if (!iso) return "";
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("en-US", long ? { weekday: "short", month: "short", day: "numeric" } : { month: "short", day: "numeric" });
}

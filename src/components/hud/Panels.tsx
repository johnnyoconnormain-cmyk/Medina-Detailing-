import Link from "next/link";
import { fmtMoney, fmtMoneyCompact } from "@/lib/money";
import { Chip, Dot, Delta, EmptyState, NotConfigured, SectionHeader, StatusChip } from "@/components/ui/primitives";
import type { AttentionItem, PipelineStage, Insight } from "@/lib/queries/hud";

/* --------------------------------------------------------------- pipeline */

export function PipelineRail({ stages }: { stages: PipelineStage[] }) {
  return (
    <div className="card overflow-hidden">
      <SectionHeader title="Pipeline" />
      <div className="grid grid-cols-2 divide-y divide-[rgb(var(--border))] sm:grid-cols-3 sm:divide-y-0 lg:grid-cols-6
                      sm:divide-x sm:[&>*]:border-b sm:[&>*]:border-[rgb(var(--border))] lg:[&>*]:border-b-0">
        {stages.map((s, i) => (
          <Link key={s.key} href={s.href}
                className="group relative border-r border-[rgb(var(--border))] px-3.5 py-3 transition-colors last:border-r-0 hover:bg-[rgb(var(--surface-2))]">
            <div className="flex items-center gap-1.5">
              <p className="label-xs">{s.label}</p>
              {i < stages.length - 1 && (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                     className="hidden text-bark-300 dark:text-bark-700 lg:block">
                  <path d="m9 6 6 6-6 6" />
                </svg>
              )}
            </div>
            <p className="tnum mt-1 text-xl font-semibold leading-none tracking-tight">{s.count}</p>
            <div className="mt-1.5 flex items-center gap-2">
              {s.valueCents > 0 && <span className="tnum text-xs text-muted">{fmtMoneyCompact(s.valueCents)}</span>}
              {s.changePct !== null && <Delta pct={s.changePct} />}
            </div>
            {s.urgent > 0 && (
              <span className="mt-1.5 inline-flex items-center gap-1 text-2xs font-semibold text-clay-600 dark:text-clay-400">
                <Dot tone="amber" />{s.urgent} need attention
              </span>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- attention */

const SEVERITY = {
  critical: { dot: "red" as const, ring: "border-l-red-500" },
  high: { dot: "amber" as const, ring: "border-l-clay-500" },
  medium: { dot: "amber" as const, ring: "border-l-clay-400" },
  low: { dot: "green" as const, ring: "border-l-moss-500" },
};

export function AttentionCenter({ items }: { items: AttentionItem[] }) {
  return (
    <div className="card min-w-0 overflow-hidden">
      <SectionHeader title="Needs your attention" count={items.length || undefined} />
      {items.length === 0 ? (
        <EmptyState title="Nothing needs you right now"
                    hint="Every lead is answered, every quote is followed up, and no invoice is overdue." />
      ) : (
        <ul className="divide-y" style={{ borderColor: "rgb(var(--border))" }}>
          {items.map((it) => (
            <li key={it.id} className={`border-l-2 ${SEVERITY[it.severity].ring}`}>
              {/* Stacks on a phone: the title, the money and the action each need
                  their full width rather than fighting over one line. */}
              <div className="flex flex-col gap-1.5 px-3.5 py-2.5 sm:flex-row sm:items-center sm:gap-3">
                <div className="min-w-0 flex-1">
                  <p className="flex items-start gap-1.5 text-sm font-medium leading-snug">
                    <span className="mt-1.5"><Dot tone={SEVERITY[it.severity].dot} /></span>
                    <span className="min-w-0 break-words">{it.title}</span>
                  </p>
                  <p className="mt-0.5 break-words pl-3 text-xs text-muted">{it.detail}</p>
                </div>
                <div className="flex items-center justify-between gap-3 pl-3 sm:pl-0">
                  {it.amountCents !== null && (
                    <span className="tnum flex-none text-sm font-semibold">{fmtMoneyCompact(it.amountCents)}</span>
                  )}
                  <Link href={it.href} className="btn btn-secondary flex-none !px-2.5 !py-1 text-2xs">
                    {it.actionLabel}
                  </Link>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ today */

type TodayJob = {
  id: string; number: number; title: string; status: string;
  scheduledStart: Date | null; scheduledEnd: Date | null; valueCents: number;
  addressLine: string | null; city: string | null;
  customerName: string; customerPhone: string | null;
  crewName: string | null; crewColor: string | null;
};

export function TodayRail({ jobs }: { jobs: TodayJob[] }) {
  const total = jobs.reduce((n, j) => n + j.valueCents, 0);
  const done = jobs.filter((j) => j.status === "complete").length;

  return (
    <div className="card overflow-hidden">
      <SectionHeader
        title="Today"
        action={
          <span className="tnum text-2xs text-muted">
            {done}/{jobs.length} done · {fmtMoney(total)}
          </span>
        }
      />
      {jobs.length === 0 ? (
        <EmptyState title="No jobs scheduled today"
                    action={<Link href="/schedule" className="btn btn-secondary text-xs">Open schedule</Link>} />
      ) : (
        <ul className="divide-y" style={{ borderColor: "rgb(var(--border))" }}>
          {jobs.map((j) => (
            <li key={j.id}>
              <Link href={`/jobs/${j.id}`} className="row-link flex items-center gap-3 px-3.5 py-2.5">
                <div className="w-[62px] flex-none">
                  <p className="tnum text-xs font-semibold leading-tight">
                    {j.scheduledStart?.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                  </p>
                  <p className="tnum text-2xs text-faint">
                    {j.scheduledEnd && j.scheduledStart
                      ? `${Math.round((j.scheduledEnd.getTime() - j.scheduledStart.getTime()) / 36e5 * 10) / 10}h`
                      : ""}
                  </p>
                </div>

                <span className="h-9 w-[3px] flex-none rounded-full"
                      style={{ background: j.crewColor ?? "rgb(var(--border-strong))" }} />

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium leading-snug">{j.customerName}</p>
                  <p className="truncate text-xs text-muted">
                    {j.title}{j.city ? ` · ${j.city}` : ""}
                  </p>
                </div>

                <div className="flex-none text-right">
                  <p className="tnum text-sm font-semibold">{fmtMoney(j.valueCents)}</p>
                  <p className="text-2xs text-faint">{j.crewName ?? "Unassigned"}</p>
                </div>

                <div className="hidden flex-none sm:block"><StatusChip status={j.status} /></div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ crews */

type CrewView = {
  id: string; name: string; color: string; status: string;
  jobs: Array<{ id: string; title: string; status: string; start: Date | null; end: Date | null; customer: string | null; valueCents: number }>;
};

export function CrewPanel({ crews }: { crews: CrewView[] }) {
  const now = Date.now();
  return (
    <div className="card overflow-hidden">
      <SectionHeader title="Crews" count={crews.length} />
      <ul className="divide-y" style={{ borderColor: "rgb(var(--border))" }}>
        {crews.map((c) => {
          const current = c.jobs.find((j) => j.status === "in_progress")
            ?? c.jobs.find((j) => j.start && j.end && j.start.getTime() <= now && j.end.getTime() >= now);
          const next = c.jobs.find((j) => j.start && j.start.getTime() > now);
          const tone = current ? "green" : next ? "blue" : "grey";
          const label = current ? "Working" : next ? "Scheduled" : "Available";

          return (
            <li key={c.id}>
              <Link href={`/schedule?crew=${c.id}`} className="row-link block px-3.5 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 flex-none rounded-sm" style={{ background: c.color }} />
                  <p className="flex-1 truncate text-sm font-medium">{c.name}</p>
                  <span className="inline-flex items-center gap-1.5 text-2xs font-semibold text-muted">
                    <Dot tone={tone} />{label}
                  </span>
                </div>
                <div className="mt-1 pl-4.5 text-xs text-muted">
                  {current ? (
                    <p className="truncate">Now: {current.customer} — {current.title}</p>
                  ) : next ? (
                    <p className="truncate">
                      Next: {next.start?.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} · {next.customer}
                    </p>
                  ) : (
                    <p>No jobs assigned today</p>
                  )}
                  <p className="tnum mt-0.5 text-2xs text-faint">
                    {c.jobs.length} job{c.jobs.length === 1 ? "" : "s"} today · {fmtMoney(c.jobs.reduce((n, j) => n + j.valueCents, 0))}
                  </p>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* --------------------------------------------------------------- activity */

export function ActivityFeed({ events }: {
  events: Array<{ id: string; kind: string; summary: string; amountCents: number | null; createdAt: Date }>;
}) {
  return (
    <div className="card overflow-hidden">
      <SectionHeader title="Activity" />
      {events.length === 0 ? (
        <EmptyState title="No activity yet" />
      ) : (
        <ul className="scroll-thin max-h-[300px] overflow-y-auto">
          {events.map((e) => (
            <li key={e.id} className="flex items-start gap-2.5 px-3.5 py-2">
              <span className="mt-1.5"><Dot tone={toneForKind(e.kind)} /></span>
              <div className="min-w-0 flex-1">
                <p className="text-xs leading-snug">{e.summary}</p>
                <p className="text-2xs text-faint">{relTime(e.createdAt)}</p>
              </div>
              {e.amountCents ? (
                <span className="tnum flex-none text-xs font-semibold">{fmtMoney(e.amountCents)}</span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function toneForKind(kind: string): "green" | "amber" | "red" | "grey" | "blue" {
  if (kind.includes("payment") || kind.includes("accepted")) return "green";
  if (kind.includes("lead") || kind.includes("review")) return "blue";
  if (kind.includes("followup") || kind.includes("invoice")) return "amber";
  return "grey";
}

function relTime(d: Date): string {
  const mins = Math.round((Date.now() - d.getTime()) / 6e4);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs === 1 ? "" : "s"} ago`;
  const days = Math.round(hrs / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

/* ---------------------------------------------------------- opportunities */

export function Opportunities({ items }: {
  items: Array<{ key: string; amountCents: number; label: string; sub: string; actionLabel: string; href: string }>;
}) {
  if (!items.length) return null;
  return (
    <div className="card overflow-hidden">
      <SectionHeader title="Revenue opportunities" />
      <ul className="divide-y" style={{ borderColor: "rgb(var(--border))" }}>
        {items.map((o) => (
          <li key={o.key} className="px-3.5 py-3">
            <p className="tnum text-xl font-semibold leading-none tracking-tight">{fmtMoney(o.amountCents)}</p>
            <p className="mt-1 text-xs text-muted">{o.label}</p>
            <div className="mt-2 flex items-center justify-between gap-2">
              <span className="text-2xs text-faint">{o.sub}</span>
              <Link href={o.href} className="btn btn-secondary !px-2.5 !py-1 text-2xs">{o.actionLabel}</Link>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* --------------------------------------------------------------- insights */

export function Insights({ items }: { items: Insight[] }) {
  return (
    <div className="card overflow-hidden">
      <SectionHeader title="Business insights" />
      {items.length === 0 ? (
        <div className="px-4 pb-4 pt-1">
          <p className="text-xs text-muted">
            Not enough history yet to say anything useful. Insights appear once there
            are enough completed jobs to compare periods honestly.
          </p>
        </div>
      ) : (
        <ul className="space-y-2 px-4 pb-4 pt-1">
          {items.map((i) => (
            <li key={i.id} className="flex gap-2 text-xs leading-relaxed">
              <span className="mt-1.5"><Dot tone={i.tone === "positive" ? "green" : i.tone === "warning" ? "amber" : "grey"} /></span>
              <span>{i.text}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ----------------------------------------------------------- funnel/map/wx */

export function FunnelPanel({ stages, days }: {
  stages: Array<{ key: string; label: string; count: number; href: string }>; days: number;
}) {
  const max = Math.max(...stages.map((s) => s.count), 1);
  const first = stages[0]?.count ?? 0;
  const last = stages[stages.length - 1]?.count ?? 0;

  return (
    <div className="card overflow-hidden">
      <SectionHeader
        title={`Lead funnel · last ${days} days`}
        action={<span className="tnum text-2xs text-muted">{first > 0 ? `${Math.round((last / first) * 100)}% end-to-end` : "—"}</span>}
      />
      <ul className="space-y-1.5 px-4 pb-4 pt-1">
        {stages.map((s, i) => {
          const prev = i > 0 ? stages[i - 1].count : null;
          const dropoff = prev && prev > 0 ? Math.round(((prev - s.count) / prev) * 100) : null;
          return (
            <li key={s.key}>
              <Link href={s.href} className="group block">
                <div className="mb-1 flex items-baseline justify-between gap-2">
                  <span className="text-xs group-hover:underline">{s.label}</span>
                  <span className="flex items-baseline gap-2">
                    {dropoff !== null && dropoff > 0 && (
                      <span className="tnum text-2xs text-faint">−{dropoff}%</span>
                    )}
                    <span className="tnum text-sm font-semibold">{s.count}</span>
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full" style={{ background: "rgb(var(--surface-2))" }}>
                  <div className="h-full rounded-full transition-all"
                       style={{ width: `${(s.count / max) * 100}%`, background: "rgb(var(--accent))", opacity: 1 - i * 0.12 }} />
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function MapPanel({ available, jobCount }: { available: boolean; jobCount: number }) {
  return (
    <div className="card overflow-hidden">
      <SectionHeader title="Today's route" action={<span className="text-2xs text-muted">{jobCount} stops</span>} />
      {available ? (
        <div className="h-48" id="map-root" />
      ) : (
        <NotConfigured
          feature="Live map"
          hint="Set MAPBOX_TOKEN or GOOGLE_MAPS_KEY to plot crews and stops. The component is wired — only the provider is missing, so no placeholder pins are drawn."
        />
      )}
    </div>
  );
}

export function WeatherPanel({ available }: { available: boolean }) {
  return (
    <div className="card overflow-hidden">
      <SectionHeader title="Field conditions" />
      {available ? (
        <div className="px-4 pb-4" id="weather-root" />
      ) : (
        <NotConfigured
          feature="Weather"
          hint="Set WEATHER_API_KEY to show the forecast and flag jobs at risk of rain. No forecast is invented in the meantime."
        />
      )}
    </div>
  );
}

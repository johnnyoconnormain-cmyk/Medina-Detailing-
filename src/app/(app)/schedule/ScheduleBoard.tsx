"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { assignCrewAction } from "@/actions/jobs";
import { fmtMoney } from "@/lib/money";

type J = {
  id: string; number: number; title: string; status: string;
  scheduledStart: string | null; scheduledEnd: string | null;
  valueCents: number; crewId: string | null; city: string | null;
  customerName: string; crewName: string | null; crewColor: string | null;
};

export function ScheduleBoard({ weekStartIso, jobs, crews }: {
  weekStartIso: string; jobs: J[]; crews: Array<{ id: string; name: string; color: string }>;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [crewFilter, setCrewFilter] = useState<string>("all");

  const weekStart = useMemo(() => new Date(weekStartIso), [weekStartIso]);
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => new Date(weekStart.getTime() + i * 864e5)),
    [weekStart],
  );

  const visible = crewFilter === "all"
    ? jobs
    : jobs.filter((j) => (crewFilter === "none" ? !j.crewId : j.crewId === crewFilter));

  const todayKey = new Date().toDateString();

  function reassign(jobId: string, crewId: string) {
    start(async () => {
      await assignCrewAction(jobId, crewId || null);
      router.refresh();
    });
  }

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 px-4 pt-3.5 pb-2">
        <h2 className="label-xs flex-1">Week</h2>
        <div className="flex flex-wrap gap-1">
          <FilterBtn active={crewFilter === "all"} onClick={() => setCrewFilter("all")}>All crews</FilterBtn>
          {crews.map((c) => (
            <FilterBtn key={c.id} active={crewFilter === c.id} onClick={() => setCrewFilter(c.id)} color={c.color}>
              {c.name}
            </FilterBtn>
          ))}
          <FilterBtn active={crewFilter === "none"} onClick={() => setCrewFilter("none")}>Unassigned</FilterBtn>
        </div>
      </div>

      <div className="scroll-thin overflow-x-auto">
        <div className="grid min-w-[880px] grid-cols-7 border-t" style={{ borderColor: "rgb(var(--border))" }}>
          {days.map((d) => {
            const dayJobs = visible.filter((j) => j.scheduledStart && new Date(j.scheduledStart).toDateString() === d.toDateString());
            const dayTotal = dayJobs.reduce((n, j) => n + j.valueCents, 0);
            const isToday = d.toDateString() === todayKey;

            return (
              <div key={d.toISOString()} className="min-h-[260px] border-r last:border-r-0"
                   style={{ borderColor: "rgb(var(--border))", background: isToday ? "rgb(var(--surface-2))" : undefined }}>
                <div className="border-b px-2 py-1.5" style={{ borderColor: "rgb(var(--border))" }}>
                  <p className={`text-2xs font-semibold uppercase tracking-wide ${isToday ? "text-moss-600 dark:text-moss-400" : "text-faint"}`}>
                    {d.toLocaleDateString("en-US", { weekday: "short" })}
                  </p>
                  <p className="flex items-baseline gap-1.5">
                    <span className={`tnum text-sm font-semibold ${isToday ? "text-moss-700 dark:text-moss-300" : ""}`}>{d.getDate()}</span>
                    {dayTotal > 0 && <span className="tnum text-2xs text-faint">{fmtMoney(dayTotal)}</span>}
                  </p>
                </div>

                <div className="space-y-1 p-1.5">
                  {dayJobs.map((j) => (
                    <div key={j.id} className="rounded border p-1.5 transition-colors hover:border-[rgb(var(--border-strong))]"
                         style={{ borderColor: "rgb(var(--border))", borderLeftWidth: 3, borderLeftColor: j.crewColor ?? "rgb(var(--border-strong))" }}>
                      <Link href={`/jobs/${j.id}`} className="block">
                        <p className="tnum text-2xs font-semibold text-faint">
                          {j.scheduledStart && new Date(j.scheduledStart).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                        </p>
                        <p className="truncate text-xs font-medium leading-tight">{j.customerName}</p>
                        <p className="truncate text-2xs text-muted">{j.title}</p>
                        <p className="tnum mt-0.5 text-2xs font-semibold">{fmtMoney(j.valueCents)}</p>
                      </Link>
                      <select
                        value={j.crewId ?? ""} disabled={pending}
                        onChange={(e) => reassign(j.id, e.target.value)}
                        aria-label={`Crew for ${j.customerName}`}
                        className="mt-1 w-full rounded border bg-transparent px-1 py-0.5 text-2xs"
                        style={{ borderColor: j.crewId ? "rgb(var(--border))" : "rgb(217 119 6)" }}
                      >
                        <option value="">Unassigned</option>
                        {crews.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                  ))}
                  {dayJobs.length === 0 && <p className="px-1 py-3 text-center text-2xs text-faint">—</p>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function FilterBtn({ active, onClick, children, color }: {
  active: boolean; onClick: () => void; children: React.ReactNode; color?: string;
}) {
  return (
    <button onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded px-2 py-1 text-2xs font-semibold transition-colors ${
        active ? "bg-bark-900 text-white dark:bg-bark-100 dark:text-bark-950" : "text-muted hover:bg-[rgb(var(--surface-2))]"
      }`}>
      {color && <span className="h-2 w-2 rounded-sm" style={{ background: color }} />}
      {children}
    </button>
  );
}

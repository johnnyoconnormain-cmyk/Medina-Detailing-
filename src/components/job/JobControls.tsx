"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { scheduleJobAction, startJobAction, completeJobAction, addJobNoteAction } from "@/actions/jobs";

export function JobControls({ jobId, status, crewId, crews, scheduledStart, durationHours, hasInvoice, notes }: {
  jobId: string; status: string; crewId: string | null;
  crews: Array<{ id: string; name: string }>;
  scheduledStart: string | null; durationHours: number;
  hasInvoice: boolean; notes: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState(notes ?? "");
  const [noteSaved, setNoteSaved] = useState(false);

  const localStart = scheduledStart ? toLocalInput(new Date(scheduledStart)) : "";
  const [when, setWhen] = useState(localStart);
  const [hours, setHours] = useState(String(durationHours));
  const [crew, setCrew] = useState(crewId ?? "");

  function save() {
    if (!when) return;
    setBusy("schedule");
    start(async () => {
      await scheduleJobAction(jobId, new Date(when).toISOString(), Number(hours) || 2, crew || undefined);
      setBusy(null); router.refresh();
    });
  }

  function run(label: string, fn: () => Promise<unknown>) {
    setBusy(label);
    start(async () => { await fn(); setBusy(null); router.refresh(); });
  }

  return (
    <div className="card overflow-hidden">
      <div className="px-4 pb-2 pt-3.5"><h2 className="label-xs">Manage</h2></div>

      <div className="space-y-2.5 px-4 pb-4">
        <div>
          <label htmlFor="when" className="label-xs mb-1 block">Date & time</label>
          <input id="when" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className="input" />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label htmlFor="hours" className="label-xs mb-1 block">Hours</label>
            <input id="hours" inputMode="decimal" value={hours} onChange={(e) => setHours(e.target.value)} className="input" />
          </div>
          <div>
            <label htmlFor="crew" className="label-xs mb-1 block">Crew</label>
            <select id="crew" value={crew} onChange={(e) => setCrew(e.target.value)} className="input">
              <option value="">Unassigned</option>
              {crews.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>

        <button onClick={save} disabled={pending || !when} className="btn btn-secondary w-full">
          {busy === "schedule" ? "Saving…" : scheduledStart ? "Update schedule" : "Schedule job"}
        </button>

        <div className="border-t pt-2.5" style={{ borderColor: "rgb(var(--border))" }}>
          {status === "scheduled" && (
            <button onClick={() => run("start", () => startJobAction(jobId))} disabled={pending} className="btn btn-primary w-full">
              {busy === "start" ? "Starting…" : "Start job"}
            </button>
          )}
          {status === "in_progress" && (
            <button onClick={() => run("complete", () => completeJobAction(jobId))} disabled={pending} className="btn btn-primary w-full">
              {busy === "complete" ? "Completing…" : "Mark complete & invoice"}
            </button>
          )}
          {status === "unscheduled" && <p className="text-center text-xs text-muted">Pick a date above to put this on the calendar.</p>}
          {status === "complete" && (
            <p className="text-center text-xs text-moss-700 dark:text-moss-400">
              Completed{hasInvoice ? " · invoice created" : ""}
            </p>
          )}
        </div>

        <div className="border-t pt-2.5" style={{ borderColor: "rgb(var(--border))" }}>
          <label htmlFor="notes" className="label-xs mb-1 block">Crew notes</label>
          <textarea id="notes" rows={3} value={noteDraft} className="input resize-y text-xs"
                    placeholder="Gate code, dog in the yard, where to dump clippings…"
                    onChange={(e) => { setNoteDraft(e.target.value); setNoteSaved(false); }} />
          <button
            onClick={() => run("note", async () => { await addJobNoteAction(jobId, noteDraft); setNoteSaved(true); })}
            disabled={pending || noteDraft === (notes ?? "")}
            className="btn btn-ghost mt-1.5 w-full border border-[rgb(var(--border))] text-xs">
            {busy === "note" ? "Saving…" : noteSaved ? "Saved" : "Save note"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** datetime-local needs local wall time, not an ISO/UTC string. */
function toLocalInput(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleAutomationAction, updateAutomationStepAction } from "@/actions/settings";
import { Chip } from "@/components/ui/primitives";
import type { AutomationStep } from "@/db/schema";

const STEP_LABEL: Record<string, string> = {
  wait: "Wait", message: "Send message", notify_owner: "Notify you",
  create_job: "Create the job", offer_times: "Offer appointment times",
  send_invoice: "Send invoice", request_review: "Request a review",
};

export function AutomationCard({ id, name, description, enabled, steps, queued }: {
  id: string; name: string; description: string; enabled: boolean;
  steps: AutomationStep[]; queued: number;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [on, setOn] = useState(enabled);
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState("");

  function toggle() {
    const next = !on;
    setOn(next);
    start(async () => { await toggleAutomationAction(id, next); router.refresh(); });
  }

  function saveStep(i: number) {
    start(async () => {
      await updateAutomationStepAction(id, i, draft);
      setEditing(null);
      router.refresh();
    });
  }

  return (
    <div className={`card overflow-hidden transition-opacity ${on ? "" : "opacity-60"}`}>
      <div className="flex items-start gap-3 px-4 pb-3 pt-3.5">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold">{name}</h2>
            {queued > 0 && <Chip tone="info">{queued} queued</Chip>}
          </div>
          {description && <p className="mt-0.5 text-xs text-muted">{description}</p>}
        </div>

        <button onClick={toggle} disabled={pending} role="switch" aria-checked={on}
                aria-label={`${on ? "Disable" : "Enable"} ${name}`}
                className={`relative h-5 w-9 flex-none rounded-full transition-colors ${
                  on ? "bg-moss-600" : "bg-bark-300 dark:bg-bark-700"
                }`}>
          <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${on ? "translate-x-[18px]" : "translate-x-0.5"}`} />
        </button>
      </div>

      <ol className="border-t" style={{ borderColor: "rgb(var(--border))" }}>
        {steps.map((s, i) => (
          <li key={i} className="flex items-start gap-3 border-b px-4 py-2.5 last:border-b-0"
              style={{ borderColor: "rgb(var(--border))" }}>
            <span className="tnum mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full border text-2xs font-semibold text-faint"
                  style={{ borderColor: "rgb(var(--border-strong))" }}>
              {i + 1}
            </span>

            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium">
                {STEP_LABEL[s.type] ?? s.type}
                {s.type === "wait" && <span className="text-muted"> {s.days} day{s.days === 1 ? "" : "s"}</span>}
                {s.type === "message" && <span className="text-muted"> by {s.channel}</span>}
              </p>

              {s.type === "message" && (
                editing === i ? (
                  <div className="mt-1.5">
                    <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={3}
                              className="input resize-y text-xs"
                              placeholder="Leave blank to let the system write it from the quote details" />
                    <p className="mt-1 text-2xs text-faint">
                      Placeholders: {"{first}"} {"{customer}"} {"{business}"}
                    </p>
                    <div className="mt-1.5 flex gap-1.5">
                      <button onClick={() => saveStep(i)} disabled={pending} className="btn btn-primary !py-1 text-2xs">
                        {pending ? "Saving…" : "Save"}
                      </button>
                      <button onClick={() => setEditing(null)} className="btn btn-ghost !py-1 text-2xs">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => { setEditing(i); setDraft(s.template); }}
                          className="mt-1 block w-full rounded border border-dashed px-2 py-1.5 text-left text-2xs leading-relaxed text-muted hover:border-solid"
                          style={{ borderColor: "rgb(var(--border-strong))" }}>
                    {s.template || <em>Written automatically from the quote — click to set your own wording</em>}
                  </button>
                )
              )}

              {s.type === "notify_owner" && (
                <p className="mt-0.5 text-2xs text-muted">{s.template}</p>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

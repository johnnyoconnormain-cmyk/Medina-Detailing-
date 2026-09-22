"use client";

import { useOptimistic, useTransition } from "react";
import { toggleChecklistAction } from "@/actions/jobs";

type Item = { id: string; label: string; done: boolean };

export function JobChecklist({ items }: { items: Item[] }) {
  const [pending, start] = useTransition();
  // Optimistic so a crew member on a slow connection sees the tick immediately.
  const [optimistic, setOptimistic] = useOptimistic(
    items,
    (state: Item[], patch: { id: string; done: boolean }) =>
      state.map((i) => (i.id === patch.id ? { ...i, done: patch.done } : i)),
  );

  function toggle(item: Item) {
    start(async () => {
      setOptimistic({ id: item.id, done: !item.done });
      await toggleChecklistAction(item.id, !item.done);
    });
  }

  if (!optimistic.length) {
    return <p className="px-4 pb-4 text-xs text-muted">No checklist on this job.</p>;
  }

  return (
    <ul className="divide-y" style={{ borderColor: "rgb(var(--border))" }}>
      {optimistic.map((i) => (
        <li key={i.id}>
          <button onClick={() => toggle(i)} disabled={pending}
            className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-[rgb(var(--surface-2))]">
            <span className={`flex h-5 w-5 flex-none items-center justify-center rounded border-2 transition-colors ${
              i.done ? "border-moss-600 bg-moss-600 text-white" : "border-bark-300 dark:border-bark-600"
            }`}>
              {i.done && (
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              )}
            </span>
            <span className={`text-sm ${i.done ? "text-faint line-through" : ""}`}>{i.label}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

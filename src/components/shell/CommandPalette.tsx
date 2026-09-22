"use client";

import { useEffect, useRef, useState, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import { globalSearch, type SearchHit } from "@/actions/search";

type Command = { id: string; label: string; hint?: string; href: string; keywords: string; group: string };

const COMMANDS: Command[] = [
  { id: "new-lead", label: "New lead", hint: "N", href: "/leads/new", keywords: "create add lead inquiry", group: "Create" },
  { id: "new-quote", label: "New quote", hint: "Q", href: "/quotes/new", keywords: "create add quote estimate bid", group: "Create" },
  { id: "new-job", label: "New job", hint: "J", href: "/jobs/new", keywords: "create add job work schedule", group: "Create" },
  { id: "new-customer", label: "New customer", hint: "C", href: "/customers/new", keywords: "create add customer client", group: "Create" },
  { id: "dash", label: "Command center", href: "/dashboard", keywords: "home dashboard hud overview", group: "Go to" },
  { id: "today", label: "Today's jobs", href: "/schedule", keywords: "today schedule calendar jobs", group: "Go to" },
  { id: "leads", label: "Lead inbox", href: "/leads", keywords: "leads inbox inquiries requests", group: "Go to" },
  { id: "quotes", label: "Quotes", href: "/quotes", keywords: "quotes estimates bids", group: "Go to" },
  { id: "unpaid", label: "Unpaid invoices", href: "/invoices?filter=unpaid", keywords: "unpaid outstanding invoices money owed collect", group: "Go to" },
  { id: "customers", label: "Customers", href: "/customers", keywords: "customers clients directory", group: "Go to" },
  { id: "analytics", label: "Analytics", href: "/analytics", keywords: "analytics reports revenue numbers", group: "Go to" },
  { id: "automations", label: "Automations", href: "/automations", keywords: "automations workflows follow up", group: "Go to" },
  { id: "settings", label: "Settings", href: "/settings", keywords: "settings pricing config preferences", group: "Go to" },
];

const TYPE_LABEL: Record<SearchHit["type"], string> = {
  customer: "Customer", job: "Job", quote: "Quote", invoice: "Invoice", lead: "Lead", employee: "Team",
};

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [active, setActive] = useState(0);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const reqId = useRef(0);

  const filteredCommands = query.trim()
    ? COMMANDS.filter((c) => (c.label + " " + c.keywords).toLowerCase().includes(query.toLowerCase()))
    : COMMANDS;

  const results: Array<{ kind: "cmd"; cmd: Command } | { kind: "hit"; hit: SearchHit }> = [
    ...filteredCommands.map((cmd) => ({ kind: "cmd" as const, cmd })),
    ...hits.map((hit) => ({ kind: "hit" as const, hit })),
  ];

  /* open/close + single-key shortcuts */
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault(); setOpen((o) => !o); return;
      }
      if (e.key === "Escape") { setOpen(false); return; }

      // Bare letter shortcuts, but never while the user is typing somewhere.
      const el = e.target as HTMLElement | null;
      const typing = el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;

      const map: Record<string, string> = { n: "/leads/new", q: "/quotes/new", j: "/jobs/new", c: "/customers/new" };
      const href = map[e.key.toLowerCase()];
      if (href) { e.preventDefault(); router.push(href); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  useEffect(() => {
    if (open) { setQuery(""); setHits([]); setActive(0); setTimeout(() => inputRef.current?.focus(), 10); }
  }, [open]);

  /* debounced server search; stale responses discarded by request id */
  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) { setHits([]); return; }
    const id = ++reqId.current;
    const t = setTimeout(() => {
      startTransition(async () => {
        try {
          const r = await globalSearch(term);
          if (id === reqId.current) setHits(r);
        } catch { if (id === reqId.current) setHits([]); }
      });
    }, 140);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => { setActive(0); }, [query, hits.length]);

  const run = useCallback((i: number) => {
    const r = results[i];
    if (!r) return;
    setOpen(false);
    router.push(r.kind === "cmd" ? r.cmd.href : r.hit.href);
  }, [results, router]);

  function onInputKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); run(active); }
  }

  if (!open) return null;

  let lastGroup = "";

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[12vh]" role="dialog" aria-modal="true" aria-label="Command palette">
      <div className="absolute inset-0 bg-bark-950/35 backdrop-blur-[2px]" onClick={() => setOpen(false)} />
      <div className="relative w-full max-w-xl overflow-hidden rounded-lg border shadow-cmd"
           style={{ background: "rgb(var(--surface))", borderColor: "rgb(var(--border-strong))" }}>
        <div className="flex items-center gap-2.5 border-b px-3.5 py-3" style={{ borderColor: "rgb(var(--border))" }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-none text-faint">
            <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
          </svg>
          <input
            ref={inputRef} value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={onInputKey}
            placeholder="Search customers, jobs, quotes — or run a command"
            className="w-full bg-transparent text-sm outline-none placeholder:text-faint"
          />
          {pending && <span className="h-3 w-3 flex-none animate-spin rounded-full border-2 border-bark-300 border-t-transparent" />}
          <kbd className="hidden flex-none rounded border px-1.5 py-0.5 text-2xs text-faint sm:block" style={{ borderColor: "rgb(var(--border))" }}>ESC</kbd>
        </div>

        <div className="scroll-thin max-h-[52vh] overflow-y-auto py-1.5">
          {results.length === 0 && (
            <p className="px-4 py-7 text-center text-xs text-muted">
              {query.trim().length >= 2 ? `Nothing found for "${query}"` : "Type to search"}
            </p>
          )}
          {results.map((r, i) => {
            const group = r.kind === "cmd" ? r.cmd.group : TYPE_LABEL[r.hit.type];
            const showHeader = group !== lastGroup;
            lastGroup = group;
            const isActive = i === active;
            return (
              <div key={r.kind === "cmd" ? r.cmd.id : `${r.hit.type}-${r.hit.id}`}>
                {showHeader && <p className="label-xs px-4 pb-1 pt-2.5">{group}</p>}
                <button
                  onMouseEnter={() => setActive(i)} onClick={() => run(i)}
                  className={`flex w-full items-center gap-3 px-4 py-2 text-left ${isActive ? "bg-bark-100 dark:bg-bark-800/70" : ""}`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {r.kind === "cmd" ? r.cmd.label : r.hit.title}
                    </span>
                    {r.kind === "hit" && (
                      <span className="block truncate text-xs text-muted">{r.hit.subtitle}</span>
                    )}
                  </span>
                  {r.kind === "cmd" && r.cmd.hint && (
                    <kbd className="flex-none rounded border px-1.5 py-0.5 text-2xs text-faint" style={{ borderColor: "rgb(var(--border))" }}>
                      {r.cmd.hint}
                    </kbd>
                  )}
                  {r.kind === "hit" && r.hit.meta && (
                    <span className="flex-none text-2xs capitalize text-faint">{r.hit.meta.replace(/_/g, " ")}</span>
                  )}
                </button>
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-4 border-t px-4 py-2 text-2xs text-faint" style={{ borderColor: "rgb(var(--border))" }}>
          <span>↑↓ navigate</span><span>↵ open</span>
          <span className="ml-auto">N lead · Q quote · J job · C customer</span>
        </div>
      </div>
    </div>
  );
}

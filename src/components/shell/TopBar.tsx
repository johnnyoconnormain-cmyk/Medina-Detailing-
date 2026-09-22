"use client";

import Link from "next/link";
import { useState, useRef, useEffect } from "react";

const CREATE_LINKS = [
  { href: "/leads/new", label: "Lead", key: "N" },
  { href: "/customers/new", label: "Customer", key: "C" },
  { href: "/quotes/new", label: "Quote", key: "Q" },
  { href: "/jobs/new", label: "Job", key: "J" },
];

export function TopBar({ title, subtitle, right }: {
  title: string; subtitle?: string; right?: React.ReactNode;
}) {
  const [menu, setMenu] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setMenu(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function openPalette() {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true }));
  }

  return (
    <header className="sticky top-0 z-20 border-b backdrop-blur"
            style={{ borderColor: "rgb(var(--border))", background: "rgb(var(--bg) / 0.88)" }}>
      <div className="flex items-center gap-3 px-4 py-2.5 pl-12 lg:pl-4">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[15px] font-semibold leading-tight tracking-tight">{title}</h1>
          {subtitle && <p className="truncate text-xs text-muted">{subtitle}</p>}
        </div>

        {right}

        <button onClick={openPalette}
          className="hidden items-center gap-2 rounded border px-2.5 py-1.5 text-xs text-faint transition-colors hover:text-[rgb(var(--text))] sm:flex"
          style={{ borderColor: "rgb(var(--border-strong))" }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
          </svg>
          <span className="hidden md:inline">Search</span>
          <kbd className="rounded border px-1 text-2xs" style={{ borderColor: "rgb(var(--border))" }}>⌘K</kbd>
        </button>

        <div className="relative flex-none" ref={ref}>
          <button onClick={() => setMenu((m) => !m)} className="btn btn-primary !px-3 !py-1.5 text-xs">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            New
          </button>
          {menu && (
            <div className="animate-fade-up absolute right-0 top-full z-30 mt-1.5 w-44 overflow-hidden rounded-lg border shadow-pop"
                 style={{ background: "rgb(var(--surface))", borderColor: "rgb(var(--border-strong))" }}>
              {CREATE_LINKS.map((l) => (
                <Link key={l.href} href={l.href} onClick={() => setMenu(false)}
                      className="flex items-center justify-between px-3 py-2 text-sm hover:bg-bark-50 dark:hover:bg-bark-800">
                  {l.label}
                  <kbd className="rounded border px-1 text-2xs text-faint" style={{ borderColor: "rgb(var(--border))" }}>{l.key}</kbd>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

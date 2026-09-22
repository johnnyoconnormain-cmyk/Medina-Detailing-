"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Avatar } from "@/components/ui/primitives";
import { ThemeToggle } from "./ThemeToggle";

type NavItem = { href: string; label: string; icon: React.ReactNode; badge?: number };

function Icon({ d, fill }: { d: string; fill?: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill={fill ? "currentColor" : "none"}
         stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="flex-none">
      <path d={d} />
    </svg>
  );
}

const ICONS = {
  hud: "M3 12h4l2-7 4 14 2-7h6",
  leads: "M4 5h16v14H4zM4 7l8 5 8-5",
  quotes: "M8 3h8l4 4v14H4V3zM14 3v5h5M8 13h8M8 17h5",
  schedule: "M4 6h16v15H4zM4 10h16M8 3v4M16 3v4",
  jobs: "M4 8h16v12H4zM9 8V5h6v3M9 14h6",
  customers: "M16 20v-2a4 4 0 0 0-8 0v2M12 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6M22 20v-2a3 3 0 0 0-2.5-3",
  invoices: "M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6",
  analytics: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  automations: "M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18",
  settings: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1 2 2 0 1 1-4 0 1.6 1.6 0 0 0-2.7-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 3 15a2 2 0 1 1 0-4 1.6 1.6 0 0 0 1.5-2.6l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 10 4.6a2 2 0 1 1 4 0 1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1A1.6 1.6 0 0 0 21 11a2 2 0 1 1 0 4 1.6 1.6 0 0 0-1.6 0z",
  crew: "M12 2 4 6v6c0 5 3.4 8.4 8 10 4.6-1.6 8-5 8-10V6z",
};

export function Sidebar({ counts, user, business }: {
  counts: { leads: number; quotes: number; unpaid: number };
  user: { name: string; role: string; avatarColor: string };
  business: { name: string };
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const items: NavItem[] = [
    { href: "/dashboard", label: "Command center", icon: <Icon d={ICONS.hud} /> },
    { href: "/leads", label: "Lead inbox", icon: <Icon d={ICONS.leads} />, badge: counts.leads },
    { href: "/quotes", label: "Quotes", icon: <Icon d={ICONS.quotes} />, badge: counts.quotes },
    { href: "/schedule", label: "Schedule", icon: <Icon d={ICONS.schedule} /> },
    { href: "/jobs", label: "Jobs", icon: <Icon d={ICONS.jobs} /> },
    { href: "/customers", label: "Customers", icon: <Icon d={ICONS.customers} /> },
    { href: "/invoices", label: "Invoices", icon: <Icon d={ICONS.invoices} />, badge: counts.unpaid },
    { href: "/analytics", label: "Analytics", icon: <Icon d={ICONS.analytics} /> },
    { href: "/automations", label: "Automations", icon: <Icon d={ICONS.automations} /> },
  ];

  const nav = (
    <nav className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-4 py-4">
        <span className="flex h-7 w-7 flex-none items-center justify-center rounded bg-moss-600 text-xs font-bold text-white">Y</span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold leading-tight">{business.name}</p>
          <p className="text-2xs text-faint">YardOps</p>
        </div>
      </div>

      <div className="scroll-thin flex-1 overflow-y-auto px-2 pb-2">
        {items.map((it) => {
          const active = pathname === it.href || (it.href !== "/dashboard" && pathname.startsWith(it.href));
          return (
            <Link key={it.href} href={it.href} onClick={() => setOpen(false)}
              className={`mb-0.5 flex items-center gap-2.5 rounded px-2.5 py-1.5 text-sm transition-colors ${
                active ? "bg-bark-100 font-semibold dark:bg-bark-800/80" : "text-muted hover:bg-bark-50 hover:text-[rgb(var(--text))] dark:hover:bg-bark-900"
              }`}>
              {it.icon}
              <span className="flex-1 truncate">{it.label}</span>
              {it.badge ? (
                <span className="tnum rounded bg-clay-100 px-1.5 py-0.5 text-2xs font-bold text-clay-800 dark:bg-clay-950 dark:text-clay-300">
                  {it.badge}
                </span>
              ) : null}
            </Link>
          );
        })}

        <div className="my-2 border-t" style={{ borderColor: "rgb(var(--border))" }} />
        <Link href="/crew" onClick={() => setOpen(false)}
          className="mb-0.5 flex items-center gap-2.5 rounded px-2.5 py-1.5 text-sm text-muted hover:bg-bark-50 dark:hover:bg-bark-900">
          <Icon d={ICONS.crew} /><span className="flex-1">Crew view</span>
          <span className="text-2xs text-faint">mobile</span>
        </Link>
        <Link href="/settings" onClick={() => setOpen(false)}
          className={`flex items-center gap-2.5 rounded px-2.5 py-1.5 text-sm ${
            pathname.startsWith("/settings") ? "bg-bark-100 font-semibold dark:bg-bark-800/80" : "text-muted hover:bg-bark-50 dark:hover:bg-bark-900"
          }`}>
          <Icon d={ICONS.settings} /><span>Settings</span>
        </Link>
      </div>

      <div className="flex items-center gap-2.5 border-t px-3 py-3" style={{ borderColor: "rgb(var(--border))" }}>
        <Avatar name={user.name} color={user.avatarColor} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold">{user.name}</p>
          <p className="text-2xs capitalize text-faint">{user.role}</p>
        </div>
        <ThemeToggle />
      </div>
    </nav>
  );

  return (
    <>
      {/* Mobile trigger */}
      <button onClick={() => setOpen(true)}
        className="btn btn-ghost fixed left-2 top-2 z-30 h-9 w-9 !p-0 lg:hidden" aria-label="Open navigation">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </button>

      <aside className="hidden w-[228px] flex-none border-r lg:block" style={{ borderColor: "rgb(var(--border))", background: "rgb(var(--surface))" }}>
        <div className="sticky top-0 h-screen">{nav}</div>
      </aside>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-bark-950/40" onClick={() => setOpen(false)} />
          <div className="animate-slide-in absolute left-0 top-0 h-full w-[260px] border-r"
               style={{ background: "rgb(var(--surface))", borderColor: "rgb(var(--border))" }}>
            {nav}
          </div>
        </div>
      )}
    </>
  );
}

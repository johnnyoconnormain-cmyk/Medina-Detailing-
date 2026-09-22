import Link from "next/link";
import { fmtMoney } from "@/lib/money";

/* ------------------------------------------------------------------ chips */

const TONES = {
  neutral: "text-bark-600 dark:text-bark-400 bg-bark-100 dark:bg-bark-800/60 border-bark-200 dark:border-bark-700",
  success: "text-moss-700 dark:text-moss-300 bg-moss-50 dark:bg-moss-950 border-moss-200 dark:border-moss-800",
  warning: "text-clay-800 dark:text-clay-300 bg-clay-50 dark:bg-clay-950 border-clay-200 dark:border-clay-900",
  danger: "text-red-800 dark:text-red-300 bg-red-50 dark:bg-red-950/60 border-red-200 dark:border-red-900",
  info: "text-sky-800 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/60 border-sky-200 dark:border-sky-900",
} as const;

export type Tone = keyof typeof TONES;

export function Chip({ tone = "neutral", children, className = "" }: {
  tone?: Tone; children: React.ReactNode; className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded border px-1.5 py-0.5 text-2xs font-semibold ${TONES[tone]} ${className}`}>
      {children}
    </span>
  );
}

const STATUS_TONE: Record<string, Tone> = {
  new: "info", contacted: "info", quoted: "warning", won: "success", lost: "neutral", archived: "neutral",
  draft: "neutral", sent: "warning", viewed: "warning", accepted: "success", declined: "neutral", expired: "neutral",
  unscheduled: "warning", scheduled: "info", in_progress: "warning", complete: "success", cancelled: "neutral",
  paid: "success", overdue: "danger", void: "neutral",
  available: "neutral", working: "success", traveling: "info", off: "neutral",
};

export function StatusChip({ status }: { status: string }) {
  return <Chip tone={STATUS_TONE[status] ?? "neutral"}>{status.replace(/_/g, " ")}</Chip>;
}

/* ----------------------------------------------------------------- layout */

export function Card({ children, className = "", as: As = "div" }: {
  children: React.ReactNode; className?: string; as?: React.ElementType;
}) {
  return <As className={`card ${className}`}>{children}</As>;
}

export function SectionHeader({ title, action, count }: {
  title: string; action?: React.ReactNode; count?: number | string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 px-4 pt-3.5 pb-2.5">
      <div className="flex items-baseline gap-2">
        <h2 className="label-xs">{title}</h2>
        {count !== undefined && <span className="text-2xs tnum text-faint">{count}</span>}
      </div>
      {action}
    </div>
  );
}

export function Money({ cents, className = "", compactCents = false }: {
  cents: number; className?: string; compactCents?: boolean;
}) {
  return <span className={`tnum ${className}`}>{fmtMoney(cents, { cents: compactCents ? undefined : false })}</span>;
}

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-10 text-center">
      <p className="text-sm font-medium">{title}</p>
      {hint && <p className="max-w-sm text-xs text-muted">{hint}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/**
 * Shown where a feature's provider isn't connected. Deliberately explicit:
 * a panel that quietly renders invented data would be worse than an empty one.
 */
export function NotConfigured({ feature, hint }: { feature: string; hint: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1.5 px-5 py-8 text-center">
      <div className="mb-1 h-8 w-8 rounded-full border border-dashed border-bark-300 dark:border-bark-700" />
      <p className="text-xs font-semibold">{feature} not connected</p>
      <p className="max-w-[16rem] text-2xs leading-relaxed text-faint">{hint}</p>
    </div>
  );
}

export function Delta({ pct, className = "" }: { pct: number | null; className?: string }) {
  if (pct === null) return <span className={`text-2xs text-faint ${className}`}>no baseline</span>;
  const up = pct >= 0;
  const flat = Math.abs(pct) < 0.5;
  return (
    <span className={`tnum text-2xs font-semibold ${className} ${
      flat ? "text-faint" : up ? "text-moss-600 dark:text-moss-400" : "text-clay-600 dark:text-clay-400"
    }`}>
      {flat ? "—" : `${up ? "↑" : "↓"} ${Math.abs(pct).toFixed(0)}%`}
    </span>
  );
}

export function Avatar({ name, color, size = 26 }: { name: string; color: string; size?: number }) {
  const initials = name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  return (
    <span
      className="inline-flex flex-none items-center justify-center rounded-full font-semibold text-white"
      style={{ background: color, width: size, height: size, fontSize: size * 0.38 }}
      aria-hidden
    >
      {initials}
    </span>
  );
}

export function RowLink({ href, children, className = "" }: {
  href: string; children: React.ReactNode; className?: string;
}) {
  return (
    <Link href={href} className={`row-link block ${className}`}>
      {children}
    </Link>
  );
}

export function Dot({ tone }: { tone: "green" | "amber" | "red" | "grey" | "blue" }) {
  const c = {
    green: "bg-moss-500", amber: "bg-clay-500", red: "bg-red-500",
    grey: "bg-bark-400", blue: "bg-sky-500",
  }[tone];
  return <span className={`inline-block h-1.5 w-1.5 flex-none rounded-full ${c}`} />;
}

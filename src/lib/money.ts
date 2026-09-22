/** Money is integer cents everywhere. These are the only places it becomes a string. */

export function fmtMoney(cents: number, opts: { cents?: boolean; sign?: boolean } = {}): string {
  const showCents = opts.cents ?? cents % 100 !== 0;
  const v = Math.abs(cents) / 100;
  const s = v.toLocaleString("en-US", {
    style: "currency", currency: "USD",
    minimumFractionDigits: showCents ? 2 : 0,
    maximumFractionDigits: showCents ? 2 : 0,
  });
  if (cents < 0) return `-${s}`;
  return opts.sign && cents > 0 ? `+${s}` : s;
}

/** Compact form for dense HUD tiles: $8.4k, $1.2M. */
export function fmtMoneyCompact(cents: number): string {
  const v = cents / 100;
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `$${(v / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (abs >= 10_000) return `$${Math.round(v / 1000)}k`;
  if (abs >= 1_000) return `$${(v / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return `$${Math.round(v)}`;
}

/** Parses user input ("1,250.50", "$1250.5") into cents. Returns null if unparseable. */
export function parseMoney(input: string): number | null {
  const cleaned = input.replace(/[$,\s]/g, "").trim();
  if (!cleaned || !/^-?\d*\.?\d*$/.test(cleaned)) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

export function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null; // null = "no baseline", not "0% change"
  return ((current - previous) / Math.abs(previous)) * 100;
}

import Link from "next/link";

/**
 * Shown only when the app is running on the in-memory demo database. Being
 * explicit matters: everything here works, but nothing survives a restart, and
 * someone should never mistake this for their real books.
 */
export function DemoBanner() {
  return (
    <div className="border-b px-4 py-1.5 text-center text-2xs"
         style={{ borderColor: "rgb(var(--border))", background: "rgb(var(--surface-2))" }}>
      <span className="font-semibold">Demo data</span>
      <span className="text-muted">
        {" "}— fully working, but nothing is saved. Attach a Postgres database to make it real.{" "}
      </span>
      <Link href="/settings" className="font-semibold text-moss-600 hover:underline dark:text-moss-400">
        How
      </Link>
    </div>
  );
}

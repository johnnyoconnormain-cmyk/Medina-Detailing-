import "server-only";
import { getSqlClient, usingRemote } from "./client";
import { MIGRATIONS } from "./migrations.generated";

/**
 * Creates the schema on first contact so a fresh deployment needs no manual SQL.
 *
 * Three things make this safe to run on every cold start:
 *
 *  - A transaction-scoped Postgres advisory lock, so the many instances a
 *    serverless host cold-starts at once cannot race to create the same tables.
 *    It releases automatically when the transaction ends, even if a process dies.
 *  - A __migrations ledger, so applied migrations are skipped. Steady-state cost
 *    is one cheap SELECT per cold start.
 *  - Per-statement savepoints that tolerate "already exists". A database can
 *    easily be half-built — someone pasted part of the schema by hand, or an
 *    earlier attempt died midway — and refusing to proceed would strand it in
 *    that state forever. In Postgres any error aborts the enclosing transaction,
 *    so each statement needs its own savepoint to be skippable.
 */

// Arbitrary but fixed: every instance must ask for the same lock.
const LOCK_KEY = 8_241_773;

/** duplicate_table, duplicate_object, duplicate_column, duplicate_schema. */
const ALREADY_EXISTS = new Set(["42P07", "42710", "42701", "42P06"]);

let done: Promise<void> | null = null;

export function ensureSchema(): Promise<void> {
  if (!done) done = run();
  return done;
}

async function run(): Promise<void> {
  // Local development migrates through `npm run db:push`.
  if (!usingRemote()) return;

  // Never touch the database while building. Prerendering would otherwise run
  // migrations against production from a build machine, and a build should not
  // have that power.
  if (process.env.NEXT_PHASE === "phase-production-build") return;

  const sql = getSqlClient();

  try {
    await sql.begin(async (tx) => {
      await tx`SELECT pg_advisory_xact_lock(${LOCK_KEY})`;
      await tx`CREATE TABLE IF NOT EXISTS __migrations (
        name text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )`;

      const applied = await tx<{ name: string }[]>`SELECT name FROM __migrations`;
      const seen = new Set(applied.map((r) => r.name));

      for (const migration of MIGRATIONS) {
        if (seen.has(migration.name)) continue;

        let created = 0, skipped = 0;
        for (const statement of migration.statements) {
          try {
            await tx.savepoint(async (sp) => { await sp.unsafe(statement); });
            created++;
          } catch (err) {
            const code = (err as { code?: string })?.code;
            if (code && ALREADY_EXISTS.has(code)) { skipped++; continue; }
            throw err;
          }
        }

        await tx`INSERT INTO __migrations (name) VALUES (${migration.name})`;
        console.log(
          `[schema] ${migration.name}: ${created} applied` +
          (skipped ? `, ${skipped} already present` : ""),
        );
      }
    });
  } catch (err) {
    // Let the next request retry rather than caching the failure forever — a
    // cold database or a transient blip shouldn't wedge the instance.
    done = null;
    throw err;
  }
}

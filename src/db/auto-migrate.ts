import "server-only";
import { getSqlClient, usingRemote } from "./client";
import { MIGRATIONS } from "./migrations.generated";

/**
 * Creates the schema on first boot so a fresh deployment needs no manual SQL.
 *
 * Two things make this safe to run on every cold start:
 *
 *  - A transaction-scoped Postgres advisory lock. Serverless spins up many
 *    instances at once and they would otherwise race to create the same tables;
 *    the lock serialises them and releases automatically when the transaction
 *    ends, even if the process dies mid-way.
 *  - A __migrations ledger, so applied migrations are skipped. The steady-state
 *    cost is one cheap SELECT per cold start.
 *
 * DDL is transactional in Postgres, so a migration that fails part way leaves
 * the database exactly as it was rather than half-built.
 */

// Arbitrary but fixed: every instance must ask for the same lock.
const LOCK_KEY = 8_241_773;

let done: Promise<void> | null = null;

export function ensureSchema(): Promise<void> {
  if (!done) done = run();
  return done;
}

async function run(): Promise<void> {
  if (!usingRemote()) return; // local dev migrates through npm run db:push
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
        for (const statement of migration.statements) {
          await tx.unsafe(statement);
        }
        await tx`INSERT INTO __migrations (name) VALUES (${migration.name})`;
        console.log(`[schema] applied ${migration.name}`);
      }
    });
  } catch (err) {
    // Let the next request retry rather than caching the failure forever — a
    // cold database or a transient network blip shouldn't wedge the instance.
    done = null;
    throw err;
  }
}

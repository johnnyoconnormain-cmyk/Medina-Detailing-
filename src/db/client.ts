/**
 * Database client.
 *
 * Two drivers, one schema, because both are genuinely PostgreSQL:
 *
 *   DATABASE_URL set  -> postgres-js over the wire. Used in development (against
 *                        the local PGlite socket server, `npm run db:serve`) and
 *                        in production (Supabase, RDS, anything).
 *   DATABASE_URL unset-> PGlite embedded in this process.
 *
 * The embedded path is single-process: PGlite holds an exclusive lock on its
 * data directory, and a second process opening it aborts the WASM engine. That
 * is why development runs the socket server instead — the Next dev server, the
 * seed script and tests all need the database at the same time.
 *
 * Migrating to Supabase is therefore a connection string, not a rewrite.
 */
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import { PGlite } from "@electric-sql/pglite";
import postgres from "postgres";
import * as schema from "./schema";

const DATA_DIR = process.env.PGLITE_DIR ?? "./.pgdata";

type PgliteDb = ReturnType<typeof drizzlePglite<typeof schema>>;
type PostgresDb = ReturnType<typeof drizzlePostgres<typeof schema>>;
export type DB = PgliteDb | PostgresDb;

// Next dev reloads modules on every edit; a global keeps one connection pool
// (and one WASM instance) alive across reloads.
const g = globalThis as unknown as {
  __pglite?: PGlite;
  __sql?: ReturnType<typeof postgres>;
  __db?: DB;
};

export function usingRemote(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

/** Serverless hosts (Vercel, Lambda) have an ephemeral, read-only filesystem. */
export function isServerless(): boolean {
  return Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NETLIFY);
}

/**
 * Demo mode: deployed with no database attached.
 *
 * Rather than refusing to boot, the app runs against an in-memory PGlite that is
 * migrated and seeded on startup. Everything works and nothing persists — each
 * cold start begins again from the same sample company. It exists so the app can
 * be looked at with zero setup; attaching DATABASE_URL turns it off.
 */
export function isDemoMode(): boolean {
  return isServerless() && !process.env.DATABASE_URL;
}

export function getPglite(): PGlite {
  if (!g.__pglite) {
    // In memory on a serverless host: its filesystem is read-only and discarded
    // between invocations, so a data directory would fail or silently lose
    // writes. On a real machine, persist to disk as usual.
    g.__pglite = isServerless() ? new PGlite() : new PGlite(DATA_DIR);
  }
  return g.__pglite;
}

export function getSqlClient() {
  return getSql();
}

function getSql() {
  if (!g.__sql) {
    // The local PGlite socket server multiplexes every connection onto a SINGLE
    // Postgres engine, so concurrent extended-protocol queries clobber each
    // other's unnamed prepared statement ("bind message supplies N parameters").
    // One connection per process serialises them. A real Postgres has no such
    // limit, so the pool opens up as soon as DATABASE_URL points at one.
    const local = /127\.0\.0\.1|localhost/.test(process.env.DATABASE_URL!);

    /*
     * Pool sizing by environment:
     *  - local PGlite socket: 1, because it multiplexes onto a single engine.
     *  - serverless: small, because every warm instance holds its own pool and
     *    Postgres connection limits are per-cluster, not per-instance. Use a
     *    pooled endpoint (Supabase pgbouncer / Neon pooler) in production.
     *  - long-lived server: a normal pool.
     */
    const max = Number(process.env.DB_POOL_MAX ?? (local ? 1 : isServerless() ? 1 : 10));

    g.__sql = postgres(process.env.DATABASE_URL!, {
      max,
      idle_timeout: 20,
      connect_timeout: 15,
      // Transaction-mode poolers do not support named prepared statements.
      prepare: !local && !isServerless(),
      onnotice: () => {},
    });
  }
  return g.__sql;
}

export function getDb(): DB {
  if (!g.__db) {
    g.__db = usingRemote()
      ? drizzlePostgres(getSql(), { schema, casing: "snake_case" })
      : drizzlePglite(getPglite(), { schema, casing: "snake_case" });
  }
  return g.__db;
}

/** Runs raw SQL on whichever driver is active. Used by migrations and seeding. */
export async function execRaw(sqlText: string): Promise<void> {
  if (usingRemote()) await getSql().unsafe(sqlText);
  else await getPglite().exec(sqlText);
}

export async function queryRaw<T = Record<string, unknown>>(sqlText: string, params: unknown[] = []): Promise<T[]> {
  if (usingRemote()) return (await getSql().unsafe(sqlText, params as never[])) as unknown as T[];
  return (await getPglite().query<T>(sqlText, params)).rows;
}

export async function closeDb(): Promise<void> {
  if (g.__sql) { await g.__sql.end({ timeout: 5 }); g.__sql = undefined; }
  if (g.__pglite) { await g.__pglite.close(); g.__pglite = undefined; }
  g.__db = undefined;
}

/**
 * Lazy handle. `export const db = getDb()` would open a connection the moment any
 * module imports this file — including during `next build`, for pages that never
 * touch the database. With embedded PGlite that means grabbing the data
 * directory's exclusive lock at build time and aborting the WASM engine if
 * another process already holds it. The proxy defers all of that to first use.
 */
export const db = new Proxy({} as DB, {
  get(_target, prop, receiver) {
    const real = getDb() as unknown as Record<string | symbol, unknown>;
    const value = Reflect.get(real, prop, receiver);
    return typeof value === "function" ? value.bind(real) : value;
  },
});

export { schema };

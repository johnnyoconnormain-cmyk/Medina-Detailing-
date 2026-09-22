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

export function getPglite(): PGlite {
  if (!g.__pglite) g.__pglite = new PGlite(DATA_DIR);
  return g.__pglite;
}

function getSql() {
  if (!g.__sql) {
    // The local PGlite socket server multiplexes every connection onto a SINGLE
    // Postgres engine, so concurrent extended-protocol queries clobber each
    // other's unnamed prepared statement ("bind message supplies N parameters").
    // One connection per process serialises them. A real Postgres has no such
    // limit, so the pool opens up as soon as DATABASE_URL points at one.
    const local = /127\.0\.0\.1|localhost/.test(process.env.DATABASE_URL!);
    g.__sql = postgres(process.env.DATABASE_URL!, {
      max: Number(process.env.DB_POOL_MAX ?? (local ? 1 : 10)),
      idle_timeout: 20,
      prepare: !local,
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

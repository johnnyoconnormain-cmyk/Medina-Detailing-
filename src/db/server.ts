/**
 * Serves the local PGlite database over the PostgreSQL wire protocol.
 *
 * Without this, PGlite can only be opened by one process, so `npm run dev` and
 * `npm run db:seed` would fight over the data directory and abort the engine.
 * With it, everything talks ordinary Postgres to localhost — exactly as it will
 * talk to Supabase later.
 */
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";

const PORT = Number(process.env.PGLITE_PORT ?? 5433);
const DATA_DIR = process.env.PGLITE_DIR ?? "./.pgdata";

async function main() {
  const pg = await PGlite.create({ dataDir: DATA_DIR });
  const server = new PGLiteSocketServer({
    db: pg,
    port: PORT,
    host: "127.0.0.1",
    // Defaults to 1, which would recreate the contention this server exists to
    // solve: the Next dev pool, the seed script and tests all connect at once.
    maxConnections: Number(process.env.PGLITE_MAX_CONNECTIONS ?? 8),
  });
  await server.start();

  console.log(`PGlite listening on postgres://postgres:postgres@127.0.0.1:${PORT}/postgres`);
  console.log(`Data directory: ${DATA_DIR}`);

  const shutdown = async () => {
    console.log("\nStopping database…");
    await server.stop();
    await pg.close();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((e) => { console.error("Database server failed:", e); process.exit(1); });

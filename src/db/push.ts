import { runMigrations } from "./migrate";
import { closeDb, usingRemote } from "./client";

runMigrations()
  .then(async (r) => {
    console.log(`${usingRemote() ? "Remote" : "Embedded"} database up to date (${r.applied} newly applied, ${r.total} total).`);
    await closeDb();
    process.exit(0);
  })
  .catch(async (e) => { console.error("Migration failed:", e); await closeDb().catch(() => {}); process.exit(1); });

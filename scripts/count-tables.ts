import { queryRaw, closeDb } from "../src/db/client";

async function main() {
  const rows = await queryRaw<{ table_name: string }>(
    "select table_name from information_schema.tables where table_schema='public' order by table_name"
  );
  console.log(`tables in public schema: ${rows.length}`);
  if (rows.length) console.log("  " + rows.map((r) => r.table_name).join(", "));
}
main().then(async () => { await closeDb(); process.exit(0); })
  .catch(async (e) => { console.error(e.message); await closeDb().catch(() => {}); process.exit(1); });

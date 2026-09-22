/** Reproduces a half-built database: enum types and a couple of tables, nothing else. */
import { execRaw, queryRaw, closeDb } from "../src/db/client";
import { MIGRATIONS } from "../src/db/migrations.generated";

async function main() {
  const statements = MIGRATIONS[0].statements;
  const partial = statements.filter((s) => s.startsWith("CREATE TYPE")).concat(
    statements.filter((s) => s.includes('CREATE TABLE "businesses"')),
  );
  for (const s of partial) await execRaw(s);
  const rows = await queryRaw<{ n: number }>(
    "select count(*)::int as n from pg_type where typname = 'crew_status'"
  );
  const tables = await queryRaw<{ table_name: string }>(
    "select table_name from information_schema.tables where table_schema='public'"
  );
  console.log(`half-applied: ${partial.length} statements`);
  console.log(`  crew_status type exists: ${rows[0].n > 0}`);
  console.log(`  tables present: ${tables.length} (${tables.map(t=>t.table_name).join(', ') || 'none'})`);
}
main().then(async () => { await closeDb(); process.exit(0); })
  .catch(async (e) => { console.error(e.message); await closeDb().catch(()=>{}); process.exit(1); });

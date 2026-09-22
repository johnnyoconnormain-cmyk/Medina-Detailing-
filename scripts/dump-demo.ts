/**
 * Emits the seeded demo company as plain INSERT statements, so it can be pasted
 * into a hosted database's web SQL editor. Avoids needing a terminal, psql or a
 * local checkout to get the demo data into production.
 */
import { closeDb, queryRaw } from "../src/db/client";
import { writeFileSync } from "node:fs";

// Parents before children — these run top to bottom under one transaction.
const TABLES = [
  "businesses", "users", "crews", "crew_members", "services", "customers",
  "leads", "quotes", "quote_items", "jobs", "job_checklist_items", "job_photos",
  "invoices", "payments", "reviews", "messages", "activity_events",
  "automations", "scheduled_tasks",
];

function lit(v: unknown): string {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "NULL";
  if (typeof v === "boolean") return v ? "true" : "false";
  if (v instanceof Date) return `'${v.toISOString()}'`;
  if (typeof v === "object") return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
  return `'${String(v).replace(/'/g, "''")}'`;
}

async function main() {
  const out: string[] = [`-- YardOps — demo company data
--
-- Run 01-schema.sql FIRST, then paste this file into the same SQL editor.
-- It loads a complete sample landscaping business so the app has something to
-- show: customers, leads, quotes, jobs, invoices, payments and history.
--
-- Sign in afterwards with:   mike@cascadegreen.com  /  demo1234
--
-- Everything runs in one transaction: if any part fails, nothing is written.

BEGIN;
`];

  let total = 0;
  for (const table of TABLES) {
    const rows = await queryRaw<Record<string, unknown>>(`SELECT * FROM ${table}`);
    if (!rows.length) continue;
    const cols = Object.keys(rows[0]);
    out.push(`\n-- ${table} (${rows.length})`);

    // Chunked so no single statement gets unwieldy in a browser editor.
    for (let i = 0; i < rows.length; i += 100) {
      const chunk = rows.slice(i, i + 100);
      const values = chunk.map((r) => `(${cols.map((c) => lit(r[c])).join(", ")})`).join(",\n  ");
      out.push(`INSERT INTO ${table} (${cols.map((c) => `"${c}"`).join(", ")}) VALUES\n  ${values};`);
    }
    total += rows.length;
  }

  out.push("\nCOMMIT;\n");
  const sql = out.join("\n");
  writeFileSync("setup/02-demo-data.sql", sql);
  console.log(`wrote setup/02-demo-data.sql — ${total} rows, ${(sql.length / 1024).toFixed(0)} KB`);
}

main().then(async () => { await closeDb(); process.exit(0); })
  .catch(async (e) => { console.error(e); await closeDb().catch(() => {}); process.exit(1); });

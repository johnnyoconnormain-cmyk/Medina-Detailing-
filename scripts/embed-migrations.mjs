/**
 * Bakes the SQL migrations into a TypeScript module.
 *
 * Reading them from disk at runtime is unreliable on serverless hosts, where
 * only traced files are deployed. Embedding removes the question entirely.
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const dir = "drizzle";
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();

const entries = files.map((name) => {
  const sql = readFileSync(join(dir, name), "utf8");
  const statements = sql
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter(Boolean);
  return { name, statements };
});

const out = `// GENERATED FILE — do not edit.
// Regenerate with: node scripts/embed-migrations.mjs
//
// The migrations are embedded rather than read from disk so they are guaranteed
// to be present in a serverless bundle.

export type Migration = { name: string; statements: string[] };

export const MIGRATIONS: Migration[] = ${JSON.stringify(entries, null, 2)};
`;

writeFileSync("src/db/migrations.generated.ts", out);
console.log(`embedded ${entries.length} migration(s), ${entries.reduce((n, e) => n + e.statements.length, 0)} statements`);

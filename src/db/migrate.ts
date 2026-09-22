/** Applies the generated SQL migrations in order. Safe to run repeatedly. */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { execRaw, queryRaw } from "./client";

export async function runMigrations(dir = "./drizzle") {
  await execRaw(`CREATE TABLE IF NOT EXISTS __migrations (
    name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now()
  );`);

  if (!existsSync(dir)) throw new Error(`No migrations directory at ${dir}. Run: npx drizzle-kit generate`);

  const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  const applied = new Set((await queryRaw<{ name: string }>("SELECT name FROM __migrations")).map((r) => r.name));

  let count = 0;
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = readFileSync(join(dir, file), "utf8");
    // drizzle-kit separates statements with this marker.
    for (const stmt of sql.split("--> statement-breakpoint")) {
      const trimmed = stmt.trim();
      if (trimmed) await execRaw(trimmed);
    }
    await execRaw(`INSERT INTO __migrations (name) VALUES ('${file.replace(/'/g, "''")}')`);
    count++;
    console.log(`  applied ${file}`);
  }
  return { applied: count, total: files.length };
}

/**
 * Starts the local database and the Next dev server together, so `npm run dev`
 * is a single command. Waits for the database to accept connections before
 * booting Next, otherwise the first render races the socket.
 */
import { spawn } from "node:child_process";
import net from "node:net";

const PORT = Number(process.env.PGLITE_PORT ?? 5433);
const URL = process.env.DATABASE_URL ?? `postgres://postgres:postgres@127.0.0.1:${PORT}/postgres`;
const children = [];

function run(cmd, args, env) {
  const c = spawn(cmd, args, { stdio: "inherit", shell: false, env: { ...process.env, ...env } });
  children.push(c);
  return c;
}

function waitForPort(port, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const tick = () => {
      const s = net.connect({ port, host: "127.0.0.1" });
      s.once("connect", () => { s.destroy(); resolve(); });
      s.once("error", () => {
        s.destroy();
        if (Date.now() > deadline) reject(new Error(`Database did not start on port ${port}`));
        else setTimeout(tick, 250);
      });
    };
    tick();
  });
}

process.on("SIGINT", () => { children.forEach((c) => c.kill("SIGINT")); process.exit(0); });
process.on("SIGTERM", () => { children.forEach((c) => c.kill("SIGTERM")); process.exit(0); });

run("npx", ["tsx", "src/db/server.ts"]);
await waitForPort(PORT);
console.log("Database ready. Starting Next…\n");
const next = run("npx", ["next", "dev"], { DATABASE_URL: URL });
next.on("exit", (code) => { children.forEach((c) => c.kill("SIGTERM")); process.exit(code ?? 0); });

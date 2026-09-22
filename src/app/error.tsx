"use client";

import { useEffect } from "react";

/**
 * Global error boundary.
 *
 * The one failure a fresh deployment actually hits is "no database attached",
 * so that case gets a setup screen with the fix on it rather than a stack
 * trace. Everything else falls through to a plain, honest error.
 */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);

  const needsDatabase = /DATABASE_URL|serverless deployment|ECONNREFUSED|getaddrinfo|connect_timeout/i.test(
    `${error.message} ${error.digest ?? ""}`,
  );

  if (needsDatabase) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col justify-center px-5 py-12">
        <span className="mb-5 flex h-9 w-9 items-center justify-center rounded bg-moss-600 text-sm font-bold text-white">Y</span>
        <p className="label-xs">Setup required</p>
        <h1 className="mt-1.5 text-2xl font-semibold tracking-tight">Connect a database</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          The app is deployed and the build is fine — it just has nowhere to store
          anything yet. Serverless filesystems are read-only and wiped between
          requests, so the bundled local database can&apos;t run here. It refuses to
          start rather than accept invoices and payments into storage that
          disappears.
        </p>

        <ol className="mt-6 space-y-4">
          <Step n="1" t="Attach Postgres">
            In your Vercel project, open <strong>Storage</strong> and add <strong>Neon</strong> or{" "}
            <strong>Supabase</strong>. Either one sets <code className="rounded bg-[rgb(var(--surface-2))] px-1 py-0.5">DATABASE_URL</code>{" "}
            automatically. Choose the <strong>pooled</strong> connection string.
          </Step>
          <Step n="2" t="Create the tables">
            Once, from your own machine:
            <pre className="mt-1.5 overflow-x-auto rounded border p-2.5 text-2xs" style={{ borderColor: "rgb(var(--border))" }}>
{`DATABASE_URL="postgres://…" npm run db:deploy
DATABASE_URL="postgres://…" npm run db:deploy:seed`}
            </pre>
            The second line loads the demo company, so there&apos;s something to look at.
          </Step>
          <Step n="3" t="Redeploy">
            Vercel redeploys on the environment variable change. Then sign in with{" "}
            <code className="rounded bg-[rgb(var(--surface-2))] px-1 py-0.5">mike@cascadegreen.com</code> / <code className="rounded bg-[rgb(var(--surface-2))] px-1 py-0.5">demo1234</code>.
          </Step>
        </ol>

        <button onClick={reset} className="btn btn-secondary mt-7 self-start text-xs">Try again</button>
        <p className="mt-3 text-2xs text-faint">
          Nothing is broken in the code — CI builds this commit green with no database present.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-5 py-12">
      <h1 className="text-xl font-semibold tracking-tight">Something went wrong</h1>
      <p className="mt-2 text-sm text-muted">
        This page hit an unexpected error. Trying again is usually enough.
      </p>
      {error.digest && <p className="tnum mt-3 text-2xs text-faint">Reference: {error.digest}</p>}
      <button onClick={reset} className="btn btn-primary mt-5 self-start">Try again</button>
    </main>
  );
}

function Step({ n, t, children }: { n: string; t: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="tnum mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full border text-2xs font-bold"
            style={{ borderColor: "rgb(var(--border-strong))" }}>{n}</span>
      <div className="min-w-0">
        <p className="text-sm font-semibold">{t}</p>
        <div className="mt-0.5 text-xs leading-relaxed text-muted">{children}</div>
      </div>
    </li>
  );
}

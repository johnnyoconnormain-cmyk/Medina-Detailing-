import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "./LoginForm";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage() {
  if (await getSession()) redirect("/dashboard");

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-7 flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded bg-moss-600 text-sm font-bold text-white">Y</span>
          <span className="text-base font-semibold tracking-tight">YardOps</span>
        </Link>

        <h1 className="text-xl font-semibold tracking-tight">Sign in</h1>
        <p className="mb-6 mt-1 text-sm text-muted">Run your day from one screen.</p>

        <LoginForm />

        <div className="mt-6 rounded-lg border p-3.5" style={{ borderColor: "rgb(var(--border))", background: "rgb(var(--surface-2))" }}>
          <p className="label-xs mb-2">Demo accounts</p>
          <dl className="space-y-1.5 text-xs">
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Owner</dt>
              <dd className="tnum font-medium">mike@cascadegreen.com</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Crew</dt>
              <dd className="tnum font-medium">luis@cascadegreen.com</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Password</dt>
              <dd className="tnum font-medium">demo1234</dd>
            </div>
          </dl>
        </div>

        <p className="mt-5 text-center text-xs text-muted">
          No account? <Link href="/signup" className="font-semibold text-moss-600 hover:underline dark:text-moss-400">Start free</Link>
        </p>
      </div>
    </main>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { SignupForm } from "./SignupForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Start free" };

export default async function SignupPage() {
  if (await getSession()) redirect("/dashboard");
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-7 flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded bg-moss-600 text-sm font-bold text-white">Y</span>
          <span className="text-base font-semibold tracking-tight">YardOps</span>
        </Link>
        <h1 className="text-xl font-semibold tracking-tight">Start free</h1>
        <p className="mb-6 mt-1 text-sm text-muted">
          Creates your company with starter services, a crew and the default automations ready to go.
        </p>
        <SignupForm />
        <p className="mt-5 text-center text-xs text-muted">
          Already have an account? <Link href="/login" className="font-semibold text-moss-600 hover:underline dark:text-moss-400">Sign in</Link>
        </p>
      </div>
    </main>
  );
}

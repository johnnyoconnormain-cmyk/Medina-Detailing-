"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { loginAction, type FormState } from "@/actions/auth";

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn btn-primary w-full">
      {pending ? "Signing in…" : label}
    </button>
  );
}

export function LoginForm() {
  const [state, action] = useActionState<FormState, FormData>(loginAction, {});

  return (
    <form action={action} className="space-y-3.5">
      <div>
        <label htmlFor="email" className="label-xs mb-1.5 block">Email</label>
        <input id="email" name="email" type="email" autoComplete="email" required
               defaultValue="mike@cascadegreen.com" className="input" />
        {state.fieldErrors?.email && <p className="mt-1 text-xs text-red-600">{state.fieldErrors.email}</p>}
      </div>

      <div>
        <label htmlFor="password" className="label-xs mb-1.5 block">Password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required
               defaultValue="demo1234" className="input" />
        {state.fieldErrors?.password && <p className="mt-1 text-xs text-red-600">{state.fieldErrors.password}</p>}
      </div>

      {state.error && (
        <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300">
          {state.error}
        </p>
      )}

      <Submit label="Sign in" />
    </form>
  );
}

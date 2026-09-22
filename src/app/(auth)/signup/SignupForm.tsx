"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { signupAction, type FormState } from "@/actions/auth";

function Submit() {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className="btn btn-primary w-full">{pending ? "Creating…" : "Create account"}</button>;
}

export function SignupForm() {
  const [state, action] = useActionState<FormState, FormData>(signupAction, {});
  return (
    <form action={action} className="space-y-3.5">
      <F name="businessName" label="Business name" err={state.fieldErrors?.businessName} placeholder="Cascade Green Landscaping" />
      <F name="name" label="Your name" err={state.fieldErrors?.name} autoComplete="name" />
      <F name="email" label="Email" type="email" err={state.fieldErrors?.email} autoComplete="email" />
      <F name="password" label="Password" type="password" err={state.fieldErrors?.password} autoComplete="new-password" hint="At least 8 characters." />
      {state.error && (
        <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300">
          {state.error}
        </p>
      )}
      <Submit />
    </form>
  );
}

function F({ name, label, type = "text", err, hint, placeholder, autoComplete }: {
  name: string; label: string; type?: string; err?: string; hint?: string; placeholder?: string; autoComplete?: string;
}) {
  return (
    <div>
      <label htmlFor={name} className="label-xs mb-1.5 block">{label}</label>
      <input id={name} name={name} type={type} required placeholder={placeholder} autoComplete={autoComplete} className="input" />
      {hint && !err && <p className="mt-1 text-2xs text-faint">{hint}</p>}
      {err && <p className="mt-1 text-xs text-red-600">{err}</p>}
    </div>
  );
}

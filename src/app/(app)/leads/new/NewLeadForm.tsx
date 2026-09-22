"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { createLeadAction, type ActionState } from "@/actions/leads";

const SOURCES = ["phone", "text", "email", "website", "referral", "facebook", "instagram", "google", "walk_by", "repeat"];

function Submit() {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className="btn btn-primary w-full">{pending ? "Saving…" : "Create lead"}</button>;
}

export function NewLeadForm({ services }: { services: Array<{ id: string; name: string }> }) {
  const [state, action] = useActionState<ActionState, FormData>(createLeadAction, {});

  return (
    <form action={action} className="card space-y-3 p-4">
      <Field name="name" label="Customer name" required error={state.fieldErrors?.name} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field name="phone" label="Phone" type="tel" />
        <Field name="email" label="Email" type="email" error={state.fieldErrors?.email} />
      </div>
      <Field name="addressLine" label="Address" />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field name="city" label="City" />
        <Field name="postalCode" label="ZIP" />
      </div>

      <div>
        <label htmlFor="serviceId" className="label-xs mb-1.5 block">Service</label>
        <select id="serviceId" name="serviceId" className="input">
          <option value="">Let the system work it out</option>
          {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      <div>
        <label htmlFor="requestText" className="label-xs mb-1.5 block">What do they need?</label>
        <textarea id="requestText" name="requestText" rows={4} required className="input resize-y"
                  placeholder="Write it the way they said it — the system reads this to classify the job and size the estimate." />
        {state.fieldErrors?.requestText && <p className="mt-1 text-xs text-red-600">{state.fieldErrors.requestText}</p>}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="source" className="label-xs mb-1.5 block">Came in via</label>
          <select id="source" name="source" className="input" defaultValue="phone">
            {SOURCES.map((s) => <option key={s} value={s} className="capitalize">{s.replace(/_/g, " ")}</option>)}
          </select>
        </div>
        <Field name="preferredDate" label="Preferred date" type="date" />
      </div>

      {state.error && <p className="rounded bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/50 dark:text-red-300">{state.error}</p>}
      <Submit />
    </form>
  );
}

function Field({ name, label, type = "text", required, error }: {
  name: string; label: string; type?: string; required?: boolean; error?: string;
}) {
  return (
    <div>
      <label htmlFor={name} className="label-xs mb-1.5 block">{label}</label>
      <input id={name} name={name} type={type} required={required} className="input" />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

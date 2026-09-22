"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { submitIntakeAction, type IntakeState } from "@/actions/intake";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn btn-primary w-full !py-3 text-base">
      {pending ? "Sending…" : "Send request"}
    </button>
  );
}

export function IntakeForm({ slug, businessName, services }: {
  slug: string; businessName: string; services: Array<{ id: string; name: string }>;
}) {
  const [state, action] = useActionState<IntakeState, FormData>(submitIntakeAction, {});
  const [previews, setPreviews] = useState<string[]>([]);

  if (state.ok) {
    return (
      <div className="card mt-7 border-moss-300 bg-moss-50 p-6 text-center dark:border-moss-800 dark:bg-moss-950">
        <p className="text-lg font-semibold text-moss-800 dark:text-moss-200">Got it — thank you!</p>
        <p className="mt-2 text-sm leading-relaxed text-moss-700 dark:text-moss-300">
          {businessName} has your request and will follow up shortly with a quote.
          Keep an eye on your texts.
        </p>
      </div>
    );
  }

  function onPick(files: FileList | null) {
    if (!files) return;
    setPreviews(Array.from(files).slice(0, 6).map((f) => URL.createObjectURL(f)));
  }

  return (
    <form action={action} className="mt-7 space-y-4">
      <input type="hidden" name="slug" value={slug} />

      <Field name="name" label="Your name" required error={state.fieldErrors?.name} autoComplete="name" />
      <Field name="phone" label="Mobile number" type="tel" required autoComplete="tel"
             hint="So we can text you the quote." />
      <Field name="email" label="Email" type="email" error={state.fieldErrors?.email} autoComplete="email" />
      <Field name="addressLine" label="Property address" autoComplete="street-address" />
      <div className="grid grid-cols-2 gap-3">
        <Field name="city" label="City" autoComplete="address-level2" />
        <Field name="postalCode" label="ZIP" autoComplete="postal-code" />
      </div>

      <div>
        <label htmlFor="serviceId" className="label-xs mb-1.5 block">What do you need?</label>
        <select id="serviceId" name="serviceId" className="input !py-2.5">
          <option value="">Not sure — you tell me</option>
          {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      <div>
        <label htmlFor="requestText" className="label-xs mb-1.5 block">Describe the work</label>
        <textarea id="requestText" name="requestText" rows={4} required className="input resize-y !py-2.5"
                  placeholder="Backyard's gotten away from us — needs a cleanup and fresh mulch in the beds." />
        {state.fieldErrors?.requestText && <p className="mt-1 text-xs text-red-600">{state.fieldErrors.requestText}</p>}
      </div>

      <div>
        <label htmlFor="photos" className="label-xs mb-1.5 block">Photos (optional, but they really help)</label>
        <input id="photos" name="photos" type="file" accept="image/*" multiple capture="environment"
               onChange={(e) => onPick(e.target.files)}
               className="block w-full text-xs file:mr-3 file:rounded file:border-0 file:bg-[rgb(var(--surface-2))] file:px-3 file:py-2 file:text-xs file:font-semibold" />
        {previews.length > 0 && (
          <div className="mt-2 grid grid-cols-3 gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {previews.map((src, i) => <img key={i} src={src} alt="" className="aspect-square w-full rounded object-cover" />)}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field name="preferredDate" label="Preferred date" type="date" />
        <div>
          <label htmlFor="preferredWindow" className="label-xs mb-1.5 block">Time of day</label>
          <select id="preferredWindow" name="preferredWindow" className="input !py-2.5">
            <option value="">Flexible</option>
            <option>Morning</option>
            <option>Afternoon</option>
          </select>
        </div>
      </div>

      {state.error && (
        <p className="rounded bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/50 dark:text-red-300">{state.error}</p>
      )}

      <Submit />
      <p className="text-center text-2xs text-faint">
        No spam. {businessName} is the only one who sees this.
      </p>
    </form>
  );
}

function Field({ name, label, type = "text", required, error, hint, autoComplete }: {
  name: string; label: string; type?: string; required?: boolean;
  error?: string; hint?: string; autoComplete?: string;
}) {
  return (
    <div>
      <label htmlFor={name} className="label-xs mb-1.5 block">{label}</label>
      <input id={name} name={name} type={type} required={required} autoComplete={autoComplete} className="input !py-2.5" />
      {hint && !error && <p className="mt-1 text-2xs text-faint">{hint}</p>}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

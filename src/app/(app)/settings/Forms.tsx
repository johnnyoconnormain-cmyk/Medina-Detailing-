"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { updatePricingAction, updateBusinessAction, type SettingsState } from "@/actions/settings";

function Save({ label = "Save changes" }: { label?: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className="btn btn-primary text-xs">{pending ? "Saving…" : label}</button>;
}

function Ok({ state }: { state: SettingsState }) {
  if (!state.ok) return null;
  return <span className="text-xs font-semibold text-moss-600 dark:text-moss-400">Saved</span>;
}

export function PricingForm(props: {
  hourlyRate: string; minimumJob: string; travelFee: string; materialMarkup: string; taxRate: string;
}) {
  const [state, action] = useActionState<SettingsState, FormData>(updatePricingAction, {});
  return (
    <form action={action} className="px-4 pb-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <F name="hourlyRate" label="Hourly labor rate" prefix="$" def={props.hourlyRate} err={state.fieldErrors?.hourlyRate} />
        <F name="minimumJob" label="Minimum job price" prefix="$" def={props.minimumJob} err={state.fieldErrors?.minimumJob} />
        <F name="travelFee" label="Travel fee" prefix="$" def={props.travelFee} err={state.fieldErrors?.travelFee} />
        <F name="materialMarkup" label="Material markup" suffix="%" def={props.materialMarkup} err={state.fieldErrors?.materialMarkup} />
        <F name="taxRate" label="Tax rate" suffix="%" def={props.taxRate} err={state.fieldErrors?.taxRate} />
      </div>
      <div className="mt-3 flex items-center gap-3"><Save /><Ok state={state} /></div>
    </form>
  );
}

export function BusinessForm(props: {
  name: string; phone: string; email: string; addressLine: string; city: string; state: string; postalCode: string;
}) {
  const [state, action] = useActionState<SettingsState, FormData>(updateBusinessAction, {});
  return (
    <form action={action} className="px-4 pb-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <F name="name" label="Business name" def={props.name} err={state.fieldErrors?.name} />
        <F name="phone" label="Phone" def={props.phone} />
        <F name="email" label="Email" def={props.email} err={state.fieldErrors?.email} />
        <F name="addressLine" label="Address" def={props.addressLine} />
        <F name="city" label="City" def={props.city} />
        <div className="grid grid-cols-2 gap-3">
          <F name="state" label="State" def={props.state} />
          <F name="postalCode" label="ZIP" def={props.postalCode} />
        </div>
      </div>
      <div className="mt-3 flex items-center gap-3"><Save /><Ok state={state} /></div>
    </form>
  );
}

function F({ name, label, def, prefix, suffix, err }: {
  name: string; label: string; def: string; prefix?: string; suffix?: string; err?: string;
}) {
  return (
    <div>
      <label htmlFor={name} className="label-xs mb-1 block">{label}</label>
      <div className="relative">
        {prefix && <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-faint">{prefix}</span>}
        <input id={name} name={name} defaultValue={def} inputMode="decimal"
               className={`input tnum ${prefix ? "!pl-6" : ""} ${suffix ? "!pr-7" : ""}`} />
        {suffix && <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-faint">{suffix}</span>}
      </div>
      {err && <p className="mt-1 text-xs text-red-600">{err}</p>}
    </div>
  );
}

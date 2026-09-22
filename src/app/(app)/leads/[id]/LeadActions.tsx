"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { updateLeadStatusAction, convertLeadToCustomerAction } from "@/actions/leads";

export function LeadActions({ leadId, status, phone, customerId, hasQuote }: {
  leadId: string; status: string; phone: string | null; customerId: string | null; hasQuote: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);

  function setStatus(next: string) {
    setBusy(next);
    start(async () => {
      await updateLeadStatusAction(leadId, next);
      setBusy(null);
      router.refresh();
    });
  }

  function buildQuote() {
    setBusy("quote");
    start(async () => {
      // A quote needs a customer record, so promote the lead first if needed.
      const id = customerId ?? (await convertLeadToCustomerAction(leadId));
      router.push(`/quotes/new?customerId=${id}&leadId=${leadId}`);
    });
  }

  return (
    <div className="card overflow-hidden">
      <div className="px-4 pt-3.5 pb-2"><h2 className="label-xs">Actions</h2></div>
      <div className="space-y-2 px-4 pb-4">
        <button onClick={buildQuote} disabled={pending} className="btn btn-primary w-full">
          {busy === "quote" ? "Opening…" : hasQuote ? "Build another quote" : "Build a quote"}
        </button>

        <div className="grid grid-cols-2 gap-2">
          <a href={phone ? `tel:${phone}` : undefined}
             className={`btn btn-secondary ${phone ? "" : "pointer-events-none opacity-40"}`}>Call</a>
          <a href={phone ? `sms:${phone}` : undefined}
             className={`btn btn-secondary ${phone ? "" : "pointer-events-none opacity-40"}`}>Text</a>
        </div>

        <div className="pt-1">
          <p className="label-xs mb-1.5">Move to</p>
          <div className="grid grid-cols-2 gap-2">
            {["contacted", "quoted", "won", "lost"].filter((s) => s !== status).map((s) => (
              <button key={s} onClick={() => setStatus(s)} disabled={pending}
                      className="btn btn-ghost border border-[rgb(var(--border))] capitalize">
                {busy === s ? "…" : s}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

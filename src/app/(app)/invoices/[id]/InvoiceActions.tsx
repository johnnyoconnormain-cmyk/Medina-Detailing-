"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { sendInvoiceReminderAction, recordManualPaymentAction } from "@/actions/invoices";
import { fmtMoney } from "@/lib/money";

export function InvoiceActions({ invoiceId, status, dueCents }: {
  invoiceId: string; status: string; dueCents: number;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);

  function run(label: string, fn: () => Promise<{ message?: string } | unknown>) {
    setBusy(label);
    start(async () => {
      const r = (await fn()) as { message?: string } | undefined;
      setMsg(r?.message ?? null);
      setBusy(null); setConfirming(null);
      router.refresh();
    });
  }

  if (status === "paid") {
    return (
      <div className="card p-4 text-center">
        <p className="text-sm font-semibold text-moss-700 dark:text-moss-400">Paid in full</p>
        <p className="mt-1 text-xs text-muted">A review request has been created for this customer.</p>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <div className="px-4 pb-2 pt-3.5"><h2 className="label-xs">Collect</h2></div>
      <div className="space-y-2 px-4 pb-4">
        <button onClick={() => run("remind", () => sendInvoiceReminderAction(invoiceId))}
                disabled={pending} className="btn btn-secondary w-full">
          {busy === "remind" ? "Sending…" : "Send payment reminder"}
        </button>

        <p className="label-xs pt-1">Record payment taken in person</p>
        <div className="grid grid-cols-3 gap-1.5">
          {(["cash", "check", "card"] as const).map((m) => (
            <button key={m} onClick={() => setConfirming(m)} disabled={pending}
                    className="btn btn-ghost border border-[rgb(var(--border))] capitalize !px-1 text-xs">
              {m}
            </button>
          ))}
        </div>

        {confirming && (
          <div className="rounded border p-2.5" style={{ borderColor: "rgb(var(--border-strong))" }}>
            <p className="text-xs">
              Record <strong>{fmtMoney(dueCents)}</strong> paid by {confirming}?
            </p>
            <div className="mt-2 flex gap-1.5">
              <button onClick={() => run("pay", () => recordManualPaymentAction(invoiceId, confirming as "cash"))}
                      disabled={pending} className="btn btn-primary flex-1 !py-1 text-xs">
                {busy === "pay" ? "Saving…" : "Confirm"}
              </button>
              <button onClick={() => setConfirming(null)} className="btn btn-ghost !py-1 text-xs">Cancel</button>
            </div>
          </div>
        )}

        {msg && <p className="text-2xs text-muted">{msg}</p>}
      </div>
    </div>
  );
}

"use client";

import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { createQuoteAction, type QuoteState } from "@/actions/quotes";
import { fmtMoney, parseMoney } from "@/lib/money";

type Customer = { id: string; name: string; city: string | null };
type Service = { id: string; name: string; basePriceCents: number; typicalHours: number };
type Line = { id: string; label: string; kind: "labor" | "material" | "disposal" | "travel" | "other"; quantity: string; unitPrice: string };

const KINDS = ["labor", "material", "disposal", "travel", "other"] as const;
let uid = 0;
const newLine = (over: Partial<Line> = {}): Line => ({
  id: `l${++uid}`, label: "", kind: "labor", quantity: "1", unitPrice: "", ...over,
});

function Submit() {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className="btn btn-primary">{pending ? "Sending…" : "Send quote"}</button>;
}

export function QuoteBuilder({ customers, services, hourlyRateCents, taxRatePct, defaults }: {
  customers: Customer[]; services: Service[];
  hourlyRateCents: number; taxRatePct: number;
  defaults: { customerId?: string; leadId?: string; title?: string };
}) {
  const [state, action] = useActionState<QuoteState, FormData>(createQuoteAction, {});
  const [lines, setLines] = useState<Line[]>([
    newLine({ label: "Labor", kind: "labor", quantity: "3", unitPrice: (hourlyRateCents / 100).toFixed(2) }),
  ]);
  const [customerId, setCustomerId] = useState(defaults.customerId ?? "");
  const [title, setTitle] = useState(defaults.title ?? "");

  const computed = useMemo(() => {
    const rows = lines.map((l) => {
      const qty = Number(l.quantity) || 0;
      const unit = parseMoney(l.unitPrice) ?? 0;
      return { ...l, qty, unit, total: Math.round(qty * unit) };
    });
    const subtotal = rows.reduce((n, r) => n + r.total, 0);
    const tax = Math.round(subtotal * (taxRatePct / 100));
    return { rows, subtotal, tax, total: subtotal + tax };
  }, [lines, taxRatePct]);

  function update(id: string, patch: Partial<Line>) {
    setLines((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }

  function applyService(serviceId: string) {
    const svc = services.find((s) => s.id === serviceId);
    if (!svc) return;
    if (!title) setTitle(svc.name);
    const next: Line[] = [
      newLine({ label: "Labor", kind: "labor", quantity: String(svc.typicalHours), unitPrice: (hourlyRateCents / 100).toFixed(2) }),
    ];
    if (svc.basePriceCents > 0) {
      next.push(newLine({ label: "Materials", kind: "material", quantity: "1", unitPrice: (svc.basePriceCents / 100).toFixed(2) }));
    }
    setLines(next);
  }

  const payload = computed.rows
    .filter((r) => r.label.trim() && r.total >= 0)
    .map((r) => ({ label: r.label.trim(), kind: r.kind, quantity: r.qty, unitPriceCents: r.unit }));

  return (
    <form action={action} className="grid gap-3 lg:grid-cols-3">
      <input type="hidden" name="items" value={JSON.stringify(payload)} />
      <input type="hidden" name="leadId" value={defaults.leadId ?? ""} />

      <div className="space-y-3 lg:col-span-2">
        <div className="card p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="customerId" className="label-xs mb-1.5 block">Customer</label>
              <select id="customerId" name="customerId" required className="input" value={customerId}
                      onChange={(e) => setCustomerId(e.target.value)}>
                <option value="">Select a customer…</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}{c.city ? ` — ${c.city}` : ""}</option>
                ))}
              </select>
              {state.fieldErrors?.customerId && <p className="mt-1 text-xs text-red-600">{state.fieldErrors.customerId}</p>}
            </div>

            <div>
              <label htmlFor="service" className="label-xs mb-1.5 block">Start from a service</label>
              <select id="service" className="input" defaultValue="" onChange={(e) => applyService(e.target.value)}>
                <option value="">Build manually…</option>
                {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>

          <div className="mt-3">
            <label htmlFor="title" className="label-xs mb-1.5 block">Quote title</label>
            <input id="title" name="title" required className="input" value={title}
                   onChange={(e) => setTitle(e.target.value)} placeholder="Backyard cleanup" />
            {state.fieldErrors?.title && <p className="mt-1 text-xs text-red-600">{state.fieldErrors.title}</p>}
          </div>
        </div>

        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-4 pt-3.5 pb-2">
            <h2 className="label-xs">Line items</h2>
            <button type="button" onClick={() => setLines((l) => [...l, newLine()])}
                    className="btn btn-ghost !px-2 !py-1 text-2xs">+ Add line</button>
          </div>

          <div className="space-y-2 px-3 pb-3">
            {computed.rows.map((r) => (
              <div key={r.id} className="grid grid-cols-[1fr_auto] gap-2 rounded border p-2 sm:grid-cols-[1fr_84px_110px_92px_28px]"
                   style={{ borderColor: "rgb(var(--border))" }}>
                <input value={r.label} onChange={(e) => update(r.id, { label: e.target.value })}
                       placeholder="Description" className="input !py-1.5 text-xs sm:col-span-1" aria-label="Line description" />
                <select value={r.kind} onChange={(e) => update(r.id, { kind: e.target.value as Line["kind"] })}
                        className="input !py-1.5 text-xs capitalize" aria-label="Line type">
                  {KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
                </select>
                <input value={r.quantity} onChange={(e) => update(r.id, { quantity: e.target.value })}
                       inputMode="decimal" placeholder="Qty" className="input !py-1.5 text-xs" aria-label="Quantity" />
                <input value={r.unitPrice} onChange={(e) => update(r.id, { unitPrice: e.target.value })}
                       inputMode="decimal" placeholder="$0.00" className="input !py-1.5 text-xs" aria-label="Unit price" />
                <div className="flex items-center justify-between gap-2 sm:contents">
                  <span className="tnum text-xs font-semibold sm:hidden">{fmtMoney(r.total)}</span>
                  <button type="button" onClick={() => setLines((ls) => ls.filter((l) => l.id !== r.id))}
                          disabled={computed.rows.length === 1}
                          className="btn btn-ghost !px-1.5 !py-1 text-xs disabled:opacity-30" aria-label="Remove line">×</button>
                </div>
              </div>
            ))}
          </div>
          {state.fieldErrors?.items && <p className="px-4 pb-3 text-xs text-red-600">{state.fieldErrors.items}</p>}
        </div>

        <div className="card p-4">
          <label htmlFor="notes" className="label-xs mb-1.5 block">Notes for the customer</label>
          <textarea id="notes" name="notes" rows={3} className="input resize-y"
                    defaultValue="Final price confirmed after on-site inspection. Quote valid 30 days." />
        </div>
      </div>

      <div className="space-y-3">
        <div className="card sticky top-16 overflow-hidden">
          <div className="px-4 pt-3.5 pb-2"><h2 className="label-xs">Total</h2></div>
          <dl className="space-y-1.5 px-4 text-sm">
            {computed.rows.filter((r) => r.label.trim()).map((r) => (
              <div key={r.id} className="flex justify-between gap-3">
                <dt className="truncate text-xs text-muted">{r.label}</dt>
                <dd className="tnum flex-none text-xs">{fmtMoney(r.total)}</dd>
              </div>
            ))}
            <div className="flex justify-between border-t pt-1.5" style={{ borderColor: "rgb(var(--border))" }}>
              <dt className="text-xs text-muted">Subtotal</dt>
              <dd className="tnum text-xs font-medium">{fmtMoney(computed.subtotal)}</dd>
            </div>
            {taxRatePct > 0 && (
              <div className="flex justify-between">
                <dt className="text-xs text-muted">Tax ({taxRatePct}%)</dt>
                <dd className="tnum text-xs">{fmtMoney(computed.tax)}</dd>
              </div>
            )}
            <div className="flex items-baseline justify-between border-t pt-2" style={{ borderColor: "rgb(var(--border))" }}>
              <dt className="text-xs font-semibold">Total</dt>
              <dd className="tnum text-xl font-semibold tracking-tight">{fmtMoney(computed.total)}</dd>
            </div>
          </dl>

          {state.error && <p className="mx-4 mt-3 rounded bg-red-50 px-2.5 py-1.5 text-xs text-red-700 dark:bg-red-950/50 dark:text-red-300">{state.error}</p>}

          <div className="p-4 pt-3">
            <Submit />
            <p className="mt-2 text-2xs leading-relaxed text-faint">
              Sending creates the customer&apos;s quote page and starts the follow-up
              sequence. It stops automatically the moment they respond.
            </p>
          </div>
        </div>
      </div>
    </form>
  );
}

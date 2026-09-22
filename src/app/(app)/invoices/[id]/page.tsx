import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCtx } from "@/lib/tenant";
import { db } from "@/db/client";
import { and, eq, asc } from "drizzle-orm";
import { invoices, customers, payments, jobs } from "@/db/schema";
import { TopBar } from "@/components/shell/TopBar";
import { Card, SectionHeader, StatusChip, Money } from "@/components/ui/primitives";
import { CopyLink } from "@/components/ui/CopyLink";
import { InvoiceActions } from "./InvoiceActions";
import { fmtMoney } from "@/lib/money";

export const metadata: Metadata = { title: "Invoice" };
export const dynamic = "force-dynamic";

export default async function InvoiceDetail({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireCtx();
  const { id } = await params;

  const [row] = await db.select({ invoice: invoices, customer: customers })
    .from(invoices).innerJoin(customers, eq(invoices.customerId, customers.id))
    .where(and(eq(invoices.id, id), eq(invoices.businessId, ctx.businessId))).limit(1);
  if (!row) notFound();

  const { invoice, customer } = row;
  const [paid, job] = await Promise.all([
    db.select().from(payments).where(eq(payments.invoiceId, invoice.id)).orderBy(asc(payments.createdAt)),
    invoice.jobId ? db.select().from(jobs).where(eq(jobs.id, invoice.jobId)).limit(1) : Promise.resolve([]),
  ]);
  const due = invoice.totalCents - invoice.amountPaidCents;

  return (
    <>
      <TopBar title={`Invoice #${invoice.number}`} subtitle={customer.name} />
      <main className="mx-auto w-full max-w-[900px] flex-1 space-y-3 p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-2">
          <StatusChip status={invoice.status} />
          {job[0] && (
            <Link href={`/jobs/${job[0].id}`} className="text-xs font-semibold text-moss-600 hover:underline dark:text-moss-400">
              Job #{job[0].number} · {job[0].title} →
            </Link>
          )}
        </div>

        <div className="grid gap-3 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <SectionHeader title="Amount" />
            <div className="px-4 pb-4">
              <p className="tnum text-3xl font-semibold tracking-tight">{fmtMoney(invoice.totalCents)}</p>
              <dl className="mt-3 space-y-1.5 text-xs">
                <Line label="Subtotal" value={fmtMoney(invoice.subtotalCents)} />
                {invoice.taxCents > 0 && <Line label="Tax" value={fmtMoney(invoice.taxCents)} />}
                <Line label="Paid" value={fmtMoney(invoice.amountPaidCents)} />
                <div className="flex justify-between border-t pt-1.5 font-semibold" style={{ borderColor: "rgb(var(--border))" }}>
                  <dt>Balance due</dt><dd className="tnum">{fmtMoney(due)}</dd>
                </div>
              </dl>

              {paid.length > 0 && (
                <div className="mt-4">
                  <p className="label-xs mb-1.5">Payments</p>
                  <ul className="space-y-1 text-xs">
                    {paid.map((p) => (
                      <li key={p.id} className="flex justify-between">
                        <span className="capitalize text-muted">{p.method} · {p.provider}</span>
                        <span className="tnum">{fmtMoney(p.amountCents)} on {p.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </Card>

          <div className="space-y-3">
            <InvoiceActions invoiceId={invoice.id} status={invoice.status} dueCents={due} />
            <Card>
              <SectionHeader title="Customer payment link" />
              <div className="px-4 pb-4">
                <CopyLink path={`/pay/${invoice.publicToken}`} />
                <Link href={`/pay/${invoice.publicToken}`} target="_blank" className="btn btn-secondary mt-2 w-full text-xs">
                  Preview
                </Link>
              </div>
            </Card>
          </div>
        </div>
      </main>
    </>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between"><dt className="text-muted">{label}</dt><dd className="tnum">{value}</dd></div>;
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCtx } from "@/lib/tenant";
import { db } from "@/db/client";
import { and, eq, desc } from "drizzle-orm";
import { leads, services, jobPhotos, quotes, customers, messages } from "@/db/schema";
import { TopBar } from "@/components/shell/TopBar";
import { Chip, StatusChip, Card, SectionHeader, Money } from "@/components/ui/primitives";
import { formatRange } from "@/lib/estimate";
import { LeadActions } from "./LeadActions";

export const metadata: Metadata = { title: "Lead" };
export const dynamic = "force-dynamic";

export default async function LeadDetail({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireCtx();
  const { id } = await params;

  const [row] = await db.select({ lead: leads, service: services })
    .from(leads).leftJoin(services, eq(leads.serviceId, services.id))
    .where(and(eq(leads.id, id), eq(leads.businessId, ctx.businessId))).limit(1);
  if (!row) notFound();

  const lead = row.lead;
  const [photos, relatedQuotes, thread] = await Promise.all([
    db.select().from(jobPhotos).where(eq(jobPhotos.leadId, lead.id)),
    db.select().from(quotes).where(eq(quotes.leadId, lead.id)).orderBy(desc(quotes.createdAt)),
    lead.customerId
      ? db.select().from(messages).where(eq(messages.customerId, lead.customerId)).orderBy(desc(messages.createdAt)).limit(10)
      : Promise.resolve([]),
  ]);

  return (
    <>
      <TopBar title={lead.name} subtitle={`Lead received ${lead.createdAt.toLocaleDateString("en-US", { month: "long", day: "numeric" })}`} />

      <main className="mx-auto w-full max-w-[1100px] flex-1 space-y-3 p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-2">
          <StatusChip status={lead.status} />
          <Chip tone="neutral">via {lead.source.replace(/_/g, " ")}</Chip>
          {(lead.urgencyScore ?? 0) >= 55 && <Chip tone="danger">Urgent signal</Chip>}
          {row.service && <Chip tone="info">{row.service.name}</Chip>}
        </div>

        <div className="grid gap-3 lg:grid-cols-3">
          <div className="space-y-3 lg:col-span-2">
            <Card>
              <SectionHeader title="The request" />
              <p className="whitespace-pre-wrap px-4 pb-4 text-sm leading-relaxed">{lead.requestText}</p>
            </Card>

            {lead.estimateLowCents && lead.estimateHighCents && (
              <Card>
                <SectionHeader title="Estimated range" />
                <div className="px-4 pb-4">
                  <p className="tnum text-2xl font-semibold tracking-tight">
                    {formatRange(lead.estimateLowCents, lead.estimateHighCents)}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    Calculated from your configured rates and typical job duration. Final price
                    is confirmed after inspection, and you can override every line on the quote.
                  </p>
                  <Link href="/settings" className="mt-2 inline-block text-xs font-semibold text-moss-600 hover:underline dark:text-moss-400">
                    Adjust pricing rules →
                  </Link>
                </div>
              </Card>
            )}

            {photos.length > 0 && (
              <Card>
                <SectionHeader title="Customer photos" count={photos.length} />
                <div className="grid grid-cols-2 gap-2 px-4 pb-4 sm:grid-cols-3">
                  {photos.map((p) => (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img key={p.id} src={p.url} alt={p.caption ?? "Customer photo"}
                         className="aspect-[4/3] w-full rounded object-cover" />
                  ))}
                </div>
              </Card>
            )}

            {relatedQuotes.length > 0 && (
              <Card>
                <SectionHeader title="Quotes" count={relatedQuotes.length} />
                <ul className="divide-y" style={{ borderColor: "rgb(var(--border))" }}>
                  {relatedQuotes.map((q) => (
                    <li key={q.id}>
                      <Link href={`/quotes/${q.id}`} className="row-link flex items-center gap-3 px-4 py-2.5">
                        <span className="flex-1 text-sm">Quote #{q.number} · {q.title}</span>
                        <StatusChip status={q.status} />
                        <Money cents={q.totalCents} className="text-sm font-semibold" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            {thread.length > 0 && (
              <Card>
                <SectionHeader title="Messages" />
                <ul className="space-y-2 px-4 pb-4">
                  {thread.map((m) => (
                    <li key={m.id} className={`rounded p-2.5 text-xs ${
                      m.direction === "outbound" ? "bg-[rgb(var(--surface-2))]" : "border border-[rgb(var(--border))]"
                    }`}>
                      <p className="mb-1 flex items-center gap-2 text-2xs text-faint">
                        <span className="font-semibold uppercase">{m.direction === "outbound" ? "Sent" : "Received"}</span>
                        <span>{m.channel}</span>
                        {m.automated && <Chip tone="neutral">automated</Chip>}
                        <span className="ml-auto">{m.createdAt.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
                      </p>
                      <p className="leading-relaxed">{m.body}</p>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </div>

          <div className="space-y-3">
            <Card>
              <SectionHeader title="Contact" />
              <dl className="space-y-2 px-4 pb-4 text-sm">
                <Field label="Name" value={lead.name} />
                {lead.phone && <Field label="Phone" value={lead.phone} href={`tel:${lead.phone}`} />}
                {lead.email && <Field label="Email" value={lead.email} href={`mailto:${lead.email}`} />}
                {lead.addressLine && (
                  <Field label="Address" value={`${lead.addressLine}${lead.city ? `, ${lead.city}` : ""} ${lead.postalCode ?? ""}`} />
                )}
                {lead.preferredDate && <Field label="Preferred" value={`${lead.preferredDate}${lead.preferredWindow ? ` · ${lead.preferredWindow}` : ""}`} />}
              </dl>
            </Card>

            <LeadActions
              leadId={lead.id}
              status={lead.status}
              phone={lead.phone}
              customerId={lead.customerId}
              hasQuote={relatedQuotes.length > 0}
            />
          </div>
        </div>
      </main>
    </>
  );
}

function Field({ label, value, href }: { label: string; value: string; href?: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="flex-none text-xs text-faint">{label}</dt>
      <dd className="text-right text-xs font-medium">
        {href ? <a href={href} className="text-moss-600 hover:underline dark:text-moss-400">{value}</a> : value}
      </dd>
    </div>
  );
}

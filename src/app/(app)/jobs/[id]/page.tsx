import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCtx } from "@/lib/tenant";
import { db } from "@/db/client";
import { and, eq, asc } from "drizzle-orm";
import { jobs, customers, crews, jobChecklistItems, jobPhotos, invoices, quotes } from "@/db/schema";
import { TopBar } from "@/components/shell/TopBar";
import { Card, SectionHeader, StatusChip, Money, Chip } from "@/components/ui/primitives";
import { JobChecklist } from "@/components/job/JobChecklist";
import { PhotoUploader } from "@/components/job/PhotoUploader";
import { JobControls } from "@/components/job/JobControls";

export const metadata: Metadata = { title: "Job" };
export const dynamic = "force-dynamic";

export default async function JobDetail({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireCtx();
  const { id } = await params;

  const [row] = await db.select({ job: jobs, customer: customers, crew: crews })
    .from(jobs)
    .innerJoin(customers, eq(jobs.customerId, customers.id))
    .leftJoin(crews, eq(jobs.crewId, crews.id))
    .where(and(eq(jobs.id, id), eq(jobs.businessId, ctx.businessId))).limit(1);
  if (!row) notFound();

  const { job, customer, crew } = row;
  const [checklist, photos, crewRows, invoiceRows, quoteRows] = await Promise.all([
    db.select().from(jobChecklistItems).where(eq(jobChecklistItems.jobId, job.id)).orderBy(asc(jobChecklistItems.sortOrder)),
    db.select().from(jobPhotos).where(eq(jobPhotos.jobId, job.id)).orderBy(asc(jobPhotos.createdAt)),
    db.select().from(crews).where(and(eq(crews.businessId, ctx.businessId), eq(crews.active, true))).orderBy(asc(crews.name)),
    db.select().from(invoices).where(eq(invoices.jobId, job.id)).limit(1),
    job.quoteId ? db.select().from(quotes).where(eq(quotes.id, job.quoteId)).limit(1) : Promise.resolve([]),
  ]);

  const before = photos.filter((p) => p.kind === "before");
  const after = photos.filter((p) => p.kind === "after");
  const other = photos.filter((p) => !["before", "after"].includes(p.kind));
  const mapsHref = job.addressLine
    ? `https://maps.google.com/?q=${encodeURIComponent(`${job.addressLine}, ${job.city ?? ""} ${job.state ?? ""}`)}`
    : null;

  return (
    <>
      <TopBar title={`${job.title}`} subtitle={`Job #${job.number} · ${customer.name}`} />

      <main className="mx-auto w-full max-w-[1100px] flex-1 space-y-3 p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-2">
          <StatusChip status={job.status} />
          {crew && <Chip tone="neutral"><span className="h-2 w-2 rounded-sm" style={{ background: crew.color }} />{crew.name}</Chip>}
          {quoteRows[0] && (
            <Link href={`/quotes/${quoteRows[0].id}`} className="text-xs font-semibold text-moss-600 hover:underline dark:text-moss-400">
              From quote #{quoteRows[0].number} →
            </Link>
          )}
          {invoiceRows[0] && (
            <Link href={`/invoices/${invoiceRows[0].id}`} className="text-xs font-semibold text-moss-600 hover:underline dark:text-moss-400">
              Invoice #{invoiceRows[0].number} ({invoiceRows[0].status}) →
            </Link>
          )}
        </div>

        <div className="grid gap-3 lg:grid-cols-3">
          <div className="space-y-3 lg:col-span-2">
            <Card>
              <SectionHeader title="Checklist"
                action={<span className="tnum text-2xs text-muted">{checklist.filter((c) => c.done).length}/{checklist.length}</span>} />
              <JobChecklist items={checklist.map((c) => ({ id: c.id, label: c.label, done: c.done }))} />
            </Card>

            <Card>
              <SectionHeader title="Before" count={before.length} />
              <PhotoUploader jobId={job.id} kind="before" photos={before.map((p) => ({ id: p.id, url: p.url, caption: p.caption }))} />
            </Card>

            <Card>
              <SectionHeader title="After" count={after.length} />
              <PhotoUploader jobId={job.id} kind="after" photos={after.map((p) => ({ id: p.id, url: p.url, caption: p.caption }))} />
            </Card>

            {other.length > 0 && (
              <Card>
                <SectionHeader title="Other photos" count={other.length} />
                <div className="grid grid-cols-3 gap-2 px-4 pb-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {other.map((p) => <img key={p.id} src={p.url} alt={p.caption ?? ""} className="aspect-[4/3] rounded object-cover" />)}
                </div>
              </Card>
            )}
          </div>

          <div className="space-y-3">
            <JobControls
              jobId={job.id}
              status={job.status}
              crewId={job.crewId}
              crews={crewRows.map((c) => ({ id: c.id, name: c.name }))}
              scheduledStart={job.scheduledStart?.toISOString() ?? null}
              durationHours={job.scheduledStart && job.scheduledEnd
                ? Math.round(((job.scheduledEnd.getTime() - job.scheduledStart.getTime()) / 36e5) * 10) / 10
                : 3}
              hasInvoice={Boolean(invoiceRows[0])}
              notes={job.crewNotes}
            />

            <Card>
              <SectionHeader title="Details" />
              <dl className="space-y-2 px-4 pb-4 text-xs">
                <Row label="Value" value={<Money cents={job.valueCents} className="font-semibold" />} />
                <Row label="Customer" value={<Link href={`/customers/${customer.id}`} className="text-moss-600 hover:underline dark:text-moss-400">{customer.name}</Link>} />
                {customer.phone && <Row label="Phone" value={<a href={`tel:${customer.phone}`} className="tnum text-moss-600 hover:underline dark:text-moss-400">{customer.phone}</a>} />}
                {job.addressLine && (
                  <Row label="Address" value={
                    mapsHref
                      ? <a href={mapsHref} target="_blank" rel="noopener" className="text-right text-moss-600 hover:underline dark:text-moss-400">{job.addressLine}<br />{job.city}</a>
                      : <span>{job.addressLine}</span>
                  } />
                )}
                {job.scheduledStart && (
                  <Row label="Scheduled" value={<span className="tnum text-right">{job.scheduledStart.toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>} />
                )}
                {job.startedAt && <Row label="Started" value={<span className="tnum">{job.startedAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</span>} />}
                {job.completedAt && <Row label="Completed" value={<span className="tnum">{job.completedAt.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>} />}
              </dl>
            </Card>
          </div>
        </div>
      </main>
    </>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="flex-none text-faint">{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  );
}

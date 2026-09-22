import "server-only";
import { db } from "./client";
import * as s from "./schema";
import { hashPassword, newPublicToken } from "../lib/auth";
import { DEFAULT_AUTOMATIONS } from "../lib/automations/defaults";
import { SERVICES, CUSTOMERS, CREW_MEMBERS, LEAD_REQUESTS, CREWS, JOB_CHECKLIST } from "./seed-data";

/**
 * Seeds the in-memory demo database.
 *
 * Runs on a cold start inside a request, so it is deliberately lean and uses
 * multi-row inserts throughout — a per-row loop here would add seconds to the
 * first page load. It is a smaller cut of the full `db:seed` dataset: enough
 * history for the dashboard, charts and funnel to be truthful, without the
 * ~400 rows of job history the real seed creates.
 */

const DAY = 864e5;
let seed = 20260922;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const pick = <T,>(a: T[]): T => a[Math.floor(rnd() * a.length)];
const rint = (lo: number, hi: number) => Math.floor(rnd() * (hi - lo + 1)) + lo;
const chance = (p: number) => rnd() < p;

export async function seedDemo(): Promise<string> {
  const now = new Date();
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const at = (d: number, h: number, m = 0) =>
    new Date(midnight.getTime() + d * DAY + h * 36e5 + m * 6e4);

  const [biz] = await db.insert(s.businesses).values({
    name: "Cascade Green Landscaping", slug: "cascade-green",
    phone: "(425) 555-0148", email: "office@cascadegreen.com",
    addressLine: "8420 Willows Rd NE", city: "Redmond", state: "WA", postalCode: "98052",
    timezone: "America/Los_Angeles", plan: "pro",
    hourlyRateCents: 8500, minimumJobCents: 18500,
    materialMarkupPct: 22, travelFeeCents: 3500, taxRatePct: 10.1,
    workingHours: {
      "0": null,
      "1": { start: 420, end: 1020 }, "2": { start: 420, end: 1020 }, "3": { start: 420, end: 1020 },
      "4": { start: 420, end: 1020 }, "5": { start: 420, end: 900 }, "6": { start: 480, end: 780 },
    },
  }).returning();
  const B = biz.id;

  const pw = await hashPassword("demo1234");
  const users = await db.insert(s.users).values(
    CREW_MEMBERS.slice(0, 5).map((u) => ({
      businessId: B, email: u.email, passwordHash: pw, name: u.name,
      role: u.role, avatarColor: u.color, phone: `(425) 555-0${rint(100, 999)}`,
    })),
  ).returning();

  const crews = await db.insert(s.crews).values(
    CREWS.map((c, i) => ({
      businessId: B, name: c.name, color: c.color,
      status: (["working", "traveling", "available"] as const)[i],
    })),
  ).returning();

  const field = users.filter((u) => u.role === "crew");
  await db.insert(s.crewMembers).values(
    field.map((u, i) => ({ businessId: B, crewId: crews[i % crews.length].id, userId: u.id })),
  );

  const services = await db.insert(s.services).values(
    SERVICES.map((v, i) => ({
      businessId: B, name: v.name, description: v.description,
      basePriceCents: v.basePriceCents, typicalHours: v.typicalHours,
      minPriceCents: v.minPriceCents, recurring: v.recurring,
      estimateLowPct: v.low, estimateHighPct: v.high, sortOrder: i,
    })),
  ).returning();
  const svcByKey = new Map(SERVICES.map((v, i) => [v.key, services[i]]));

  const customers = await db.insert(s.customers).values(
    CUSTOMERS.map((c, i) => ({
      businessId: B, name: c.name,
      email: `${c.name.split(" ")[0].toLowerCase()}@example.com`,
      phone: `(425) ${rint(200, 799)}-${rint(1000, 9999)}`,
      addressLine: c.street, city: c.city, state: "WA", postalCode: c.zip,
      lat: c.lat, lng: c.lng, tags: i % 5 === 0 ? ["recurring"] : [],
      createdAt: new Date(now.getTime() - rint(30, 400) * DAY),
    })),
  ).returning();

  /* ---- history: enough for the charts, funnel and analytics to be real ---- */

  let jobNo = 1000, invNo = 1000, quoteNo = 1000;
  const histJobs: (typeof s.jobs.$inferInsert)[] = [];
  const spans: { value: number; end: Date; custId: string }[] = [];

  for (let d = 120; d >= 1; d--) {
    const date = new Date(midnight.getTime() - d * DAY);
    if (date.getDay() === 0) continue;
    const month = date.getMonth();
    const weight = [0.35, 0.4, 0.7, 1, 1.15, 1.1, 1, 0.95, 1.05, 0.85, 0.5, 0.35][month];
    for (let k = 0; k < Math.round(rnd() * 2.2 * weight); k++) {
      const cust = pick(customers);
      const svc = pick(services);
      const hours = svc.typicalHours * (0.8 + rnd() * 0.6);
      const value = Math.max(biz.minimumJobCents,
        Math.round((biz.hourlyRateCents * hours + svc.basePriceCents) / 500) * 500);
      const start = new Date(date.getTime() + rint(7, 14) * 36e5);
      const end = new Date(start.getTime() + hours * 36e5);
      histJobs.push({
        businessId: B, customerId: cust.id, crewId: pick(crews).id, number: ++jobNo,
        title: svc.name, status: "complete", scheduledStart: start, scheduledEnd: end,
        startedAt: start, completedAt: end, valueCents: value,
        addressLine: cust.addressLine, city: cust.city, state: "WA",
        postalCode: cust.postalCode, lat: cust.lat, lng: cust.lng,
        createdAt: new Date(start.getTime() - rint(3, 18) * DAY),
      });
      spans.push({ value, end, custId: cust.id });
    }
  }
  const doneJobs = await db.insert(s.jobs).values(histJobs).returning();

  const invRows = doneJobs.map((j, i) => {
    const tax = Math.round(j.valueCents * (biz.taxRatePct / 100));
    const total = j.valueCents + tax;
    const unpaid = i > doneJobs.length - 12 && chance(0.4);
    return {
      businessId: B, customerId: j.customerId, jobId: j.id, number: ++invNo,
      publicToken: newPublicToken(), status: (unpaid ? "sent" : "paid") as "sent" | "paid",
      subtotalCents: j.valueCents, taxCents: tax, totalCents: total,
      amountPaidCents: unpaid ? 0 : total,
      sentAt: spans[i].end, dueAt: new Date(spans[i].end.getTime() + 14 * DAY),
      paidAt: unpaid ? null : new Date(spans[i].end.getTime() + rint(0, 8) * DAY),
      createdAt: spans[i].end,
    };
  });
  const invoices = await db.insert(s.invoices).values(invRows).returning();

  const payRows = invoices
    .filter((inv) => inv.status === "paid")
    .map((inv) => ({
      businessId: B, invoiceId: inv.id, amountCents: inv.totalCents,
      method: (chance(0.7) ? "card" : "check") as "card" | "check",
      provider: "manual", providerRef: `demo_${inv.number}`,
      createdAt: inv.paidAt ?? inv.createdAt!,
    }));
  if (payRows.length) await db.insert(s.payments).values(payRows);

  const reviewRows = doneJobs.filter(() => chance(0.3)).slice(0, 25).map((j) => ({
    businessId: B, customerId: j.customerId, jobId: j.id, publicToken: newPublicToken(),
    rating: chance(0.8) ? 5 : chance(0.6) ? 4 : rint(2, 3),
    requestedAt: j.completedAt, respondedAt: j.completedAt, routedToPublic: chance(0.5),
  }));
  if (reviewRows.length) await db.insert(s.reviews).values(reviewRows);

  /* ---------------------------------------------------------- live pipeline */

  const leads = await db.insert(s.leads).values(
    LEAD_REQUESTS.slice(0, 22).map((req, i) => {
      const cust = customers[i % customers.length];
      const age = Math.floor((i / 22) * 24);
      const status = age <= 3 ? "new" : age <= 7 ? "contacted" : age <= 15 ? "quoted"
        : chance(0.5) ? "won" : "lost";
      return {
        businessId: B, customerId: cust.id, name: cust.name, email: cust.email,
        phone: cust.phone, addressLine: cust.addressLine, city: cust.city,
        state: "WA", postalCode: cust.postalCode,
        serviceId: svcByKey.get(req.service)?.id ?? null,
        requestText: req.text,
        source: req.source as typeof s.leadSource.enumValues[number],
        status: status as typeof s.leadStatus.enumValues[number],
        createdAt: new Date(now.getTime() - age * DAY - rint(0, 18) * 36e5),
      };
    }),
  ).returning();

  const quoteRows: (typeof s.quotes.$inferInsert)[] = [];
  const quoteMeta: { labor: number; material: number; hours: number }[] = [];
  for (const lead of leads) {
    if (!["quoted", "won", "lost"].includes(lead.status)) continue;
    const svc = services.find((x) => x.id === lead.serviceId) ?? services[0];
    const hours = svc.typicalHours * (0.85 + rnd() * 0.5);
    const labor = Math.round((biz.hourlyRateCents * hours) / 500) * 500;
    const material = svc.basePriceCents > 0 ? Math.round(svc.basePriceCents / 500) * 500 : 0;
    const subtotal = Math.max(biz.minimumJobCents, labor + material + biz.travelFeeCents);
    const tax = Math.round(subtotal * (biz.taxRatePct / 100));
    const status = lead.status === "won" ? "accepted" : lead.status === "lost" ? "declined"
      : chance(0.3) ? "viewed" : "sent";
    const sentAt = new Date(lead.createdAt!.getTime() + rint(4, 36) * 36e5);
    quoteRows.push({
      businessId: B, customerId: lead.customerId!, leadId: lead.id, number: ++quoteNo,
      publicToken: newPublicToken(), title: svc.name,
      notes: "Final price confirmed after on-site inspection. Quote valid 30 days.",
      status: status as typeof s.quoteStatus.enumValues[number],
      subtotalCents: subtotal, taxCents: tax, totalCents: subtotal + tax,
      validUntil: new Date(sentAt.getTime() + 30 * DAY), sentAt,
      viewedAt: status === "sent" ? null : new Date(sentAt.getTime() + rint(2, 40) * 36e5),
      respondedAt: ["accepted", "declined"].includes(status)
        ? new Date(sentAt.getTime() + rint(20, 100) * 36e5) : null,
      createdAt: sentAt,
    });
    quoteMeta.push({ labor, material, hours });
  }
  const quotes = quoteRows.length ? await db.insert(s.quotes).values(quoteRows).returning() : [];

  if (quotes.length) {
    await db.insert(s.quoteItems).values(
      quotes.flatMap((q, i) => {
        const m = quoteMeta[i];
        const items = [
          { label: "Labor", kind: "labor", quantity: Number(m.hours.toFixed(1)), unit: biz.hourlyRateCents, total: m.labor },
          ...(m.material ? [{ label: "Materials", kind: "material", quantity: 1, unit: m.material, total: m.material }] : []),
          { label: "Travel", kind: "travel", quantity: 1, unit: biz.travelFeeCents, total: biz.travelFeeCents },
        ];
        return items.map((it, k) => ({
          businessId: B, quoteId: q.id, label: it.label, kind: it.kind,
          quantity: it.quantity, unitPriceCents: it.unit, totalCents: it.total, sortOrder: k,
        }));
      }),
    );
  }

  /* ------------------------------------------------------------ today + soon */

  const plan = [
    { h: 8, m: 0, k: "cleanup", c: 0, st: "in_progress" as const },
    { h: 9, m: 0, k: "mulch", c: 1, st: "in_progress" as const },
    { h: 11, m: 30, k: "maintenance", c: 1, st: "scheduled" as const },
    { h: 13, m: 0, k: "tree", c: 0, st: "scheduled" as const },
    { h: 14, m: 0, k: "irrigation", c: 2, st: "scheduled" as const },
    { h: 15, m: 30, k: "sodcare", c: 2, st: "scheduled" as const },
  ];

  const liveRows = plan.map((p, i) => {
    const svc = svcByKey.get(p.k)!;
    const cust = customers[(i * 3 + 2) % customers.length];
    const start = at(0, p.h, p.m);
    return {
      businessId: B, customerId: cust.id, crewId: crews[p.c].id, number: ++jobNo,
      title: svc.name, description: svc.description, status: p.st,
      scheduledStart: start, scheduledEnd: new Date(start.getTime() + svc.typicalHours * 36e5),
      startedAt: p.st === "in_progress" ? start : null,
      valueCents: Math.max(biz.minimumJobCents,
        Math.round((biz.hourlyRateCents * svc.typicalHours + svc.basePriceCents) / 500) * 500),
      addressLine: cust.addressLine, city: cust.city, state: "WA",
      postalCode: cust.postalCode, lat: cust.lat, lng: cust.lng,
      createdAt: new Date(now.getTime() - rint(4, 16) * DAY),
    };
  });

  for (let d = 1; d <= 10; d++) {
    const date = at(d, 0);
    if (date.getDay() === 0) continue;
    for (let k = 0; k < rint(1, 3); k++) {
      const svc = pick(services);
      const cust = pick(customers);
      const start = at(d, rint(7, 15), pick([0, 30]));
      liveRows.push({
        businessId: B, customerId: cust.id,
        crewId: (d === 1 && k === 0 ? null : pick(crews).id) as string,
        number: ++jobNo, title: svc.name, description: svc.description,
        status: "scheduled", scheduledStart: start,
        scheduledEnd: new Date(start.getTime() + svc.typicalHours * 36e5),
        startedAt: null,
        valueCents: Math.max(biz.minimumJobCents,
          Math.round((biz.hourlyRateCents * svc.typicalHours + svc.basePriceCents) / 500) * 500),
        addressLine: cust.addressLine, city: cust.city, state: "WA",
        postalCode: cust.postalCode, lat: cust.lat, lng: cust.lng,
        createdAt: new Date(now.getTime() - rint(1, 14) * DAY),
      });
    }
  }
  const liveJobs = await db.insert(s.jobs).values(liveRows).returning();

  await db.insert(s.jobChecklistItems).values(
    liveJobs.slice(0, 6).flatMap((j, ji) =>
      JOB_CHECKLIST.map((label, i) => ({
        businessId: B, jobId: j.id, label, sortOrder: i,
        done: ji < 2 && i < 2,
        doneAt: ji < 2 && i < 2 ? new Date(now.getTime() - (2 - i) * 36e5) : undefined,
      })),
    ),
  );

  await db.insert(s.jobPhotos).values(
    doneJobs.slice(0, 8).flatMap((j) => [
      { businessId: B, jobId: j.id, kind: "before" as const, url: `/seed-photos/before-${rint(1, 3)}.svg`, caption: "Before work began", createdAt: j.startedAt ?? undefined },
      { businessId: B, jobId: j.id, kind: "after" as const, url: `/seed-photos/after-${rint(1, 3)}.svg`, caption: "Completed", createdAt: j.completedAt ?? undefined },
    ]),
  );

  await db.insert(s.automations).values(
    DEFAULT_AUTOMATIONS.map((a) => ({ businessId: B, key: a.key, name: a.name, steps: a.steps, enabled: true })),
  );

  const open = quotes.filter((q) => q.status === "sent" || q.status === "viewed");
  if (open.length) {
    const [followUp] = await db.select().from(s.automations).limit(1);
    await db.insert(s.scheduledTasks).values(
      open.slice(0, 6).map((q) => ({
        businessId: B, automationId: followUp?.id ?? null, automationKey: "quote_followup",
        stepIndex: 1, entityType: "quote", entityId: q.id,
        runAt: new Date(q.sentAt!.getTime() + DAY), status: "pending" as const,
      })),
    );
    await db.insert(s.messages).values(
      open.slice(0, 8).map((q) => {
        const c = customers.find((x) => x.id === q.customerId)!;
        return {
          businessId: B, customerId: c.id, quoteId: q.id,
          direction: "outbound" as const, channel: "sms" as const,
          body: `Hi ${c.name.split(" ")[0]}, your ${q.title.toLowerCase()} quote from Cascade Green is ready to view.`,
          automated: true, createdAt: q.sentAt!,
        };
      }),
    );
  }

  await db.insert(s.activityEvents).values(
    ([
      ["quote_accepted", "Sarah Miller accepted a $620 quote", 62000, 2],
      ["photos_uploaded", "Crew A uploaded 4 job photos", null, 9],
      ["payment_received", "Greg Nakamura paid invoice #1024", 48500, 16],
      ["lead_received", "New lead received from website", null, 24],
      ["job_completed", "Crew B completed Mulch Installation", 39500, 47],
      ["quote_sent", "Quote #1041 sent to Priya Raghavan", 87000, 71],
      ["review_received", "Thomas Reyes left a 5-star review", null, 98],
    ] as const).map(([kind, summary, amt, mins]) => ({
      businessId: B, kind, summary, amountCents: amt ?? undefined,
      actorUserId: users[0].id, createdAt: new Date(now.getTime() - mins * 6e4),
    })),
  );

  return users[0].id;
}

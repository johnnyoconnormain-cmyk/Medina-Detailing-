/**
 * Seeds a complete, believable landscaping business.
 *
 * Deterministic: a fixed-seed PRNG means every run produces the identical
 * dataset, so screenshots, tests and demos stay stable.
 */
import { db, execRaw, closeDb, usingRemote } from "./client";
import { and, eq } from "drizzle-orm";
import { runMigrations } from "./migrate";
import * as s from "./schema";
import { hashPassword, newPublicToken } from "../lib/auth";
import { DEFAULT_AUTOMATIONS } from "../lib/automations/defaults";
import { SERVICES, CUSTOMERS, CREW_MEMBERS, LEAD_REQUESTS, CREWS, JOB_CHECKLIST } from "./seed-data";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

/* ---------------------------------------------------------------- helpers */

let seed = 20260921;
function rnd(): number {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
}
const pick = <T,>(arr: T[]): T => arr[Math.floor(rnd() * arr.length)];
const rint = (min: number, max: number) => Math.floor(rnd() * (max - min + 1)) + min;
const chance = (p: number) => rnd() < p;

const DAY = 864e5;
const now = new Date();
const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
const at = (dayOffset: number, hour: number, min = 0) =>
  new Date(startOfToday.getTime() + dayOffset * DAY + hour * 36e5 + min * 6e4);

/** PNW landscaping demand curve — busy spring/summer, tapering through fall. */
function seasonalWeight(d: Date): number {
  const m = d.getMonth();
  return [0.35, 0.4, 0.7, 1.0, 1.15, 1.1, 1.0, 0.95, 1.05, 0.85, 0.5, 0.35][m];
}

const phone = () => `(425) ${rint(200, 799)}-${String(rint(1000, 9999))}`;

/* ----------------------------------------------------------- placeholders */

/**
 * Job photos ship as generated SVG tiles rather than stock images. They are
 * labelled as documentation placeholders so nobody mistakes them for real
 * before/after work — the upload path is fully functional, so a real photo
 * replaces one the moment a crew takes it.
 */
function writePhotoPlaceholders(dir: string) {
  mkdirSync(dir, { recursive: true });
  const variants: Array<{ file: string; kind: "BEFORE" | "AFTER"; a: string; b: string }> = [
    { file: "before-1.svg", kind: "BEFORE", a: "#6f6859", b: "#3a3630" },
    { file: "before-2.svg", kind: "BEFORE", a: "#585245", b: "#26231e" },
    { file: "before-3.svg", kind: "BEFORE", a: "#8a8376", b: "#4a463c" },
    { file: "after-1.svg", kind: "AFTER", a: "#3a8059", b: "#1d4230" },
    { file: "after-2.svg", kind: "AFTER", a: "#5a9c77", b: "#22523a" },
    { file: "after-3.svg", kind: "AFTER", a: "#2a6746", b: "#0d1f17" },
  ];
  for (const v of variants) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${v.a}"/><stop offset="1" stop-color="${v.b}"/>
    </linearGradient>
    <pattern id="p" width="28" height="28" patternUnits="userSpaceOnUse" patternTransform="rotate(32)">
      <rect width="28" height="28" fill="none"/>
      <path d="M0 14h28" stroke="rgba(255,255,255,.05)" stroke-width="9"/>
    </pattern>
  </defs>
  <rect width="800" height="600" fill="url(#g)"/>
  <rect width="800" height="600" fill="url(#p)"/>
  <text x="40" y="72" font-family="ui-sans-serif,system-ui,sans-serif" font-size="26"
        font-weight="700" letter-spacing="3" fill="rgba(255,255,255,.92)">${v.kind}</text>
  <text x="40" y="104" font-family="ui-sans-serif,system-ui,sans-serif" font-size="15"
        fill="rgba(255,255,255,.55)">Sample documentation image</text>
</svg>`;
    writeFileSync(join(dir, v.file), svg);
  }
}

/* -------------------------------------------------------------------- run */

async function main() {
  console.log(usingRemote() ? "Connected over DATABASE_URL" : "Using embedded PGlite");
  console.log("Running migrations…");
  await runMigrations();

  console.log("Clearing existing data…");
  await execRaw(`TRUNCATE TABLE
    scheduled_tasks, automations, activity_events, messages, reviews, payments, invoices,
    job_photos, job_checklist_items, jobs, quote_items, quotes, leads, customers,
    services, crew_members, crews, sessions, users, businesses CASCADE;`);

  writePhotoPlaceholders(join(process.cwd(), "public", "seed-photos"));

  /* business */
  const [biz] = await db.insert(s.businesses).values({
    name: "Cascade Green Landscaping",
    slug: "cascade-green",
    phone: "(425) 555-0148",
    email: "office@cascadegreen.com",
    addressLine: "8420 Willows Rd NE",
    city: "Redmond", state: "WA", postalCode: "98052",
    timezone: "America/Los_Angeles",
    plan: "pro",
    hourlyRateCents: 8500,
    minimumJobCents: 18500,
    materialMarkupPct: 22,
    travelFeeCents: 3500,
    taxRatePct: 10.1,
    workingHours: {
      "0": null,
      "1": { start: 7 * 60, end: 17 * 60 }, "2": { start: 7 * 60, end: 17 * 60 },
      "3": { start: 7 * 60, end: 17 * 60 }, "4": { start: 7 * 60, end: 17 * 60 },
      "5": { start: 7 * 60, end: 15 * 60 }, "6": { start: 8 * 60, end: 13 * 60 },
    },
    defaultJobBufferMin: 30,
  }).returning();
  const B = biz.id;

  /* users */
  const pw = await hashPassword("demo1234");
  const users = await db.insert(s.users).values(
    CREW_MEMBERS.map((u) => ({
      businessId: B, email: u.email, passwordHash: pw, name: u.name,
      role: u.role, avatarColor: u.color, phone: phone(),
    })),
  ).returning();
  const owner = users[0];

  /* crews */
  const crews = await db.insert(s.crews).values(
    CREWS.map((c, i) => ({
      businessId: B, name: c.name, color: c.color,
      status: (["working", "traveling", "available"] as const)[i],
    })),
  ).returning();

  const fieldStaff = users.filter((u) => u.role === "crew");
  await db.insert(s.crewMembers).values(
    fieldStaff.map((u, i) => ({ businessId: B, crewId: crews[i % crews.length].id, userId: u.id })),
  );

  /* services */
  const services = await db.insert(s.services).values(
    SERVICES.map((sv, i) => ({
      businessId: B, name: sv.name, description: sv.description,
      basePriceCents: sv.basePriceCents, typicalHours: sv.typicalHours,
      minPriceCents: sv.minPriceCents, recurring: sv.recurring,
      estimateLowPct: sv.low, estimateHighPct: sv.high, sortOrder: i,
    })),
  ).returning();
  const svcByKey = new Map(SERVICES.map((sv, i) => [sv.key, services[i]]));

  /* customers */
  const customers = await db.insert(s.customers).values(
    CUSTOMERS.map((c, i) => ({
      businessId: B, name: c.name,
      email: `${c.name.split(" ")[0].toLowerCase()}.${c.name.split(" ").pop()!.toLowerCase()}@example.com`,
      phone: phone(), addressLine: c.street, city: c.city, state: "WA",
      postalCode: c.zip, lat: c.lat, lng: c.lng,
      tags: i % 5 === 0 ? ["recurring"] : i % 7 === 0 ? ["commercial"] : [],
      createdAt: new Date(now.getTime() - rint(20, 500) * DAY),
    })),
  ).returning();

  console.log(`  business, ${users.length} users, ${crews.length} crews, ${services.length} services, ${customers.length} customers`);

  /* ---------------------------------------------------- historical volume */

  let jobNum = 1000, quoteNum = 1000, invNum = 1000;
  const activity: Array<typeof s.activityEvents.$inferInsert> = [];
  let historicJobs = 0, historicRevenue = 0;

  for (let d = 182; d >= 1; d--) {
    const date = new Date(startOfToday.getTime() - d * DAY);
    const dow = date.getDay();
    if (dow === 0) continue;                       // closed Sundays
    const weight = seasonalWeight(date) * (dow === 6 ? 0.45 : 1);
    const count = Math.max(0, Math.round((rnd() * 3.4 + 0.7) * weight));

    for (let k = 0; k < count; k++) {
      const cust = pick(customers);
      const svc = pick(services);
      const hours = svc.typicalHours * (0.75 + rnd() * 0.7);
      const value = Math.max(
        biz.minimumJobCents,
        Math.round((biz.hourlyRateCents * hours + svc.basePriceCents * (0.8 + rnd() * 0.5)) / 500) * 500,
      );
      const startH = rint(7, 14);
      const start = new Date(date.getTime() + startH * 36e5);
      const end = new Date(start.getTime() + hours * 36e5);

      const [job] = await db.insert(s.jobs).values({
        businessId: B, customerId: cust.id, crewId: pick(crews).id,
        number: ++jobNum, title: svc.name, status: "complete",
        scheduledStart: start, scheduledEnd: end,
        startedAt: start, completedAt: end,
        valueCents: value,
        addressLine: cust.addressLine, city: cust.city, state: "WA",
        postalCode: cust.postalCode, lat: cust.lat, lng: cust.lng,
        createdAt: new Date(start.getTime() - rint(3, 21) * DAY),
      }).returning();

      const tax = Math.round(value * (biz.taxRatePct / 100));
      const total = value + tax;
      // A small tail of recent invoices stays unpaid — that's the collections queue.
      const unpaid = d < 24 && chance(0.18);

      const [inv] = await db.insert(s.invoices).values({
        businessId: B, customerId: cust.id, jobId: job.id, number: ++invNum,
        publicToken: newPublicToken(), status: unpaid ? "sent" : "paid",
        subtotalCents: value, taxCents: tax, totalCents: total,
        amountPaidCents: unpaid ? 0 : total,
        sentAt: end, dueAt: new Date(end.getTime() + 14 * DAY),
        paidAt: unpaid ? null : new Date(end.getTime() + rint(0, 9) * DAY),
        createdAt: end,
      }).returning();

      if (!unpaid) {
        await db.insert(s.payments).values({
          businessId: B, invoiceId: inv.id, amountCents: total,
          method: chance(0.72) ? "card" : chance(0.5) ? "check" : "ach",
          provider: "manual", providerRef: `seed_${inv.number}`,
          createdAt: new Date(end.getTime() + rint(0, 9) * DAY),
        });
        historicRevenue += total;
      }

      if (chance(0.34)) {
        await db.insert(s.reviews).values({
          businessId: B, customerId: cust.id, jobId: job.id,
          publicToken: newPublicToken(),
          rating: chance(0.82) ? 5 : chance(0.6) ? 4 : rint(2, 3),
          requestedAt: new Date(end.getTime() + DAY),
          respondedAt: new Date(end.getTime() + rint(1, 5) * DAY),
          routedToPublic: chance(0.5),
        });
      }
      historicJobs++;
    }
  }
  console.log(`  ${historicJobs} historical jobs, $${Math.round(historicRevenue / 100).toLocaleString()} collected`);

  /* ------------------------------------------------------------ live leads */

  const leadRows: Array<typeof s.leads.$inferInsert> = [];
  LEAD_REQUESTS.forEach((req, i) => {
    const cust = customers[i % customers.length];
    const svc = svcByKey.get(req.service)!;
    const age = Math.floor((i / LEAD_REQUESTS.length) * 26);
    // Older leads have mostly progressed; fresh ones are still new.
    const status = age <= 2 ? "new" : age <= 5 ? (chance(0.5) ? "new" : "contacted")
      : age <= 12 ? "quoted" : chance(0.45) ? "won" : chance(0.5) ? "lost" : "quoted";

    leadRows.push({
      businessId: B, customerId: chance(0.6) ? cust.id : null,
      name: cust.name, email: cust.email, phone: cust.phone,
      addressLine: cust.addressLine, city: cust.city, state: "WA", postalCode: cust.postalCode,
      serviceId: svc.id, requestText: req.text,
      source: req.source as typeof s.leadSource.enumValues[number],
      status: status as typeof s.leadStatus.enumValues[number],
      preferredDate: chance(0.4) ? new Date(now.getTime() + rint(3, 20) * DAY).toISOString().slice(0, 10) : null,
      preferredWindow: chance(0.4) ? pick(["Morning", "Afternoon", "Flexible"]) : null,
      createdAt: new Date(now.getTime() - age * DAY - rint(0, 20) * 36e5),
    });
  });
  const leads = await db.insert(s.leads).values(leadRows).returning();

  /* ----------------------------------------------------------- live quotes */

  const openQuotes: typeof s.quotes.$inferSelect[] = [];
  let quoteCount = 0;

  for (const lead of leads) {
    if (!["quoted", "won", "lost"].includes(lead.status)) continue;
    if (quoteCount >= 30) break;
    quoteCount++;

    const svc = services.find((x) => x.id === lead.serviceId) ?? services[0];
    const cust = customers.find((c) => c.name === lead.name)!;
    const hours = svc.typicalHours * (0.8 + rnd() * 0.6);
    const labor = Math.round((biz.hourlyRateCents * hours) / 500) * 500;
    const material = svc.basePriceCents > 0 ? Math.round((svc.basePriceCents * (0.85 + rnd() * 0.4)) / 500) * 500 : 0;
    const disposal = chance(0.55) ? rint(5, 16) * 500 : 0;

    const subtotal = Math.max(biz.minimumJobCents, labor + material + disposal + biz.travelFeeCents);
    const tax = Math.round(subtotal * (biz.taxRatePct / 100));
    const status = lead.status === "won" ? "accepted" : lead.status === "lost" ? "declined" : chance(0.25) ? "viewed" : "sent";
    const sentAt = new Date(lead.createdAt!.getTime() + rint(4, 40) * 36e5);

    const [q] = await db.insert(s.quotes).values({
      businessId: B, customerId: cust.id, leadId: lead.id, number: ++quoteNum,
      publicToken: newPublicToken(), title: svc.name,
      notes: "Final price confirmed after on-site inspection. Quote valid 30 days.",
      status: status as typeof s.quoteStatus.enumValues[number],
      subtotalCents: subtotal, taxCents: tax, totalCents: subtotal + tax,
      validUntil: new Date(sentAt.getTime() + 30 * DAY),
      sentAt, viewedAt: status === "sent" ? null : new Date(sentAt.getTime() + rint(1, 48) * 36e5),
      respondedAt: ["accepted", "declined"].includes(status) ? new Date(sentAt.getTime() + rint(24, 120) * 36e5) : null,
      createdAt: sentAt,
    }).returning();

    const items = [
      { label: "Labor", kind: "labor", quantity: Number(hours.toFixed(1)), unit: biz.hourlyRateCents, total: labor },
      ...(material ? [{ label: "Materials", kind: "material", quantity: 1, unit: material, total: material }] : []),
      ...(disposal ? [{ label: "Debris disposal", kind: "disposal", quantity: 1, unit: disposal, total: disposal }] : []),
      { label: "Travel", kind: "travel", quantity: 1, unit: biz.travelFeeCents, total: biz.travelFeeCents },
    ];
    await db.insert(s.quoteItems).values(items.map((it, i) => ({
      businessId: B, quoteId: q.id, label: it.label, kind: it.kind,
      quantity: it.quantity, unitPriceCents: it.unit, totalCents: it.total, sortOrder: i,
    })));

    if (status === "sent" || status === "viewed") openQuotes.push(q);
  }
  /* ------------------------------------ accepted quotes become real jobs */

  /*
   * The product's core promise is Lead -> Quote -> Accept -> Schedule ->
   * Complete -> Pay. Seeding jobs that aren't linked to the quote that won them
   * would leave that chain unrepresented and make the cohort funnel read zero
   * at the bottom. Every accepted quote therefore gets its real job.
   */
  const acceptedQuotes = await db.select().from(s.quotes)
    .where(and(eq(s.quotes.businessId, B), eq(s.quotes.status, "accepted")));

  let chainComplete = 0, chainScheduled = 0;

  for (const q of acceptedQuotes) {
    const cust = customers.find((c) => c.id === q.customerId)!;
    const accepted = q.respondedAt ?? q.sentAt ?? new Date();
    const daysSinceAccept = Math.floor((now.getTime() - accepted.getTime()) / DAY);

    // Older acceptances have already been worked; recent ones are still booked.
    const finished = daysSinceAccept > 6;
    const start = finished
      ? new Date(accepted.getTime() + rint(2, 5) * DAY + rint(7, 14) * 36e5)
      : at(rint(1, 9), rint(8, 14), pick([0, 30]));
    const durationH = 2 + rnd() * 4;
    const end = new Date(start.getTime() + durationH * 36e5);

    const [job] = await db.insert(s.jobs).values({
      businessId: B, customerId: cust.id, quoteId: q.id, crewId: pick(crews).id,
      number: ++jobNum, title: q.title,
      description: services.find((x) => x.name === q.title)?.description ?? null,
      status: finished ? "complete" : "scheduled",
      scheduledStart: start, scheduledEnd: end,
      startedAt: finished ? start : null,
      completedAt: finished ? end : null,
      valueCents: q.totalCents,
      addressLine: cust.addressLine, city: cust.city, state: "WA",
      postalCode: cust.postalCode, lat: cust.lat, lng: cust.lng,
      createdAt: accepted,
    }).returning();

    if (!finished) { chainScheduled++; continue; }

    const [inv] = await db.insert(s.invoices).values({
      businessId: B, customerId: cust.id, jobId: job.id, number: ++invNum,
      publicToken: newPublicToken(),
      status: chance(0.78) ? "paid" : "sent",
      subtotalCents: q.subtotalCents, taxCents: q.taxCents, totalCents: q.totalCents,
      amountPaidCents: 0, sentAt: end, dueAt: new Date(end.getTime() + 14 * DAY),
      createdAt: end,
    }).returning();

    if (inv.status === "paid") {
      const paidAt = new Date(end.getTime() + rint(1, 10) * DAY);
      await db.update(s.invoices)
        .set({ amountPaidCents: inv.totalCents, paidAt })
        .where(eq(s.invoices.id, inv.id));
      await db.insert(s.payments).values({
        businessId: B, invoiceId: inv.id, amountCents: inv.totalCents,
        method: chance(0.7) ? "card" : "check", provider: "manual",
        providerRef: `seed_${inv.number}`, createdAt: paidAt,
      });
    }
    chainComplete++;
  }
  console.log(`  ${acceptedQuotes.length} accepted quotes -> ${chainComplete} completed + ${chainScheduled} booked jobs`);

  console.log(`  ${leads.length} leads, ${quoteCount} quotes (${openQuotes.length} awaiting response)`);

  /* ------------------------------------------------- today + upcoming jobs */

  const liveJobs: typeof s.jobs.$inferSelect[] = [];
  const todayPlan = [
    { h: 8, m: 0, svc: "cleanup", crew: 0, status: "in_progress" as const },
    { h: 9, m: 0, svc: "mulch", crew: 1, status: "in_progress" as const },
    { h: 11, m: 30, svc: "maintenance", crew: 1, status: "scheduled" as const },
    { h: 13, m: 0, svc: "tree", crew: 0, status: "scheduled" as const },
    { h: 14, m: 0, svc: "irrigation", crew: 2, status: "scheduled" as const },
    { h: 15, m: 30, svc: "sodcare", crew: 2, status: "scheduled" as const },
  ];

  for (let i = 0; i < todayPlan.length; i++) {
    const p = todayPlan[i];
    const svc = svcByKey.get(p.svc)!;
    const cust = customers[(i * 3 + 2) % customers.length];
    const value = Math.max(biz.minimumJobCents, Math.round((biz.hourlyRateCents * svc.typicalHours + svc.basePriceCents) / 500) * 500);
    const start = at(0, p.h, p.m);

    const [job] = await db.insert(s.jobs).values({
      businessId: B, customerId: cust.id, crewId: crews[p.crew].id, quoteId: null,
      number: ++jobNum, title: svc.name, description: svc.description,
      status: p.status, scheduledStart: start,
      scheduledEnd: new Date(start.getTime() + svc.typicalHours * 36e5),
      startedAt: p.status === "in_progress" ? start : null,
      valueCents: value, addressLine: cust.addressLine, city: cust.city, state: "WA",
      postalCode: cust.postalCode, lat: cust.lat, lng: cust.lng,
      createdAt: new Date(now.getTime() - rint(4, 18) * DAY),
    }).returning();
    liveJobs.push(job);
  }

  // Upcoming two weeks, plus a couple deliberately left unassigned for the HUD to flag.
  for (let d = 1; d <= 14; d++) {
    const date = at(d, 0);
    if (date.getDay() === 0) continue;
    for (let k = 0; k < rint(1, 4); k++) {
      const svc = pick(services);
      const cust = pick(customers);
      const value = Math.max(biz.minimumJobCents, Math.round((biz.hourlyRateCents * svc.typicalHours + svc.basePriceCents) / 500) * 500);
      const start = at(d, rint(7, 15), pick([0, 30]));
      const unassigned = d === 1 && k === 0;

      const [job] = await db.insert(s.jobs).values({
        businessId: B, customerId: cust.id,
        crewId: unassigned ? null : pick(crews).id,
        number: ++jobNum, title: svc.name, description: svc.description,
        status: "scheduled", scheduledStart: start,
        scheduledEnd: new Date(start.getTime() + svc.typicalHours * 36e5),
        valueCents: value, addressLine: cust.addressLine, city: cust.city, state: "WA",
        postalCode: cust.postalCode, lat: cust.lat, lng: cust.lng,
        createdAt: new Date(now.getTime() - rint(1, 20) * DAY),
      }).returning();
      liveJobs.push(job);
    }
  }

  /* checklists + photos on today's work */
  for (const job of liveJobs.slice(0, 8)) {
    const done = job.status === "in_progress" ? rint(1, 3) : 0;
    await db.insert(s.jobChecklistItems).values(
      JOB_CHECKLIST.map((label, i) => ({
        businessId: B, jobId: job.id, label, sortOrder: i,
        done: i < done, doneAt: i < done ? new Date(now.getTime() - (done - i) * 36e5) : null,
        doneByUserId: i < done ? pick(fieldStaff).id : null,
      })),
    );
  }

  const completedForPhotos = await db.select().from(s.jobs)
    .where(and(eq(s.jobs.businessId, B), eq(s.jobs.status, "complete"))).limit(14);
  for (const job of completedForPhotos) {
    const n = rint(1, 3);
    for (let i = 1; i <= n; i++) {
      await db.insert(s.jobPhotos).values([
        { businessId: B, jobId: job.id, kind: "before", url: `/seed-photos/before-${rint(1, 3)}.svg`, caption: "Before work began", uploadedByUserId: pick(fieldStaff).id, createdAt: job.startedAt ?? job.createdAt },
        { businessId: B, jobId: job.id, kind: "after", url: `/seed-photos/after-${rint(1, 3)}.svg`, caption: "Completed", uploadedByUserId: pick(fieldStaff).id, createdAt: job.completedAt ?? job.createdAt },
      ]);
      if (i >= 2) break;
    }
  }

  /* automations */
  await db.insert(s.automations).values(
    DEFAULT_AUTOMATIONS.map((a) => ({ businessId: B, key: a.key, name: a.name, steps: a.steps, enabled: true })),
  );

  const [followUpAuto] = await db.select().from(s.automations)
    .where(and(eq(s.automations.businessId, B), eq(s.automations.key, "quote_followup")));

  // Pending follow-ups on the genuinely open quotes.
  for (const q of openQuotes.slice(0, 9)) {
    await db.insert(s.scheduledTasks).values({
      businessId: B, automationId: followUpAuto?.id ?? null,
      automationKey: "quote_followup", stepIndex: 1,
      entityType: "quote", entityId: q.id,
      runAt: new Date(q.sentAt!.getTime() + DAY),
      status: "pending",
    });
  }

  /* messages + activity */
  for (const q of openQuotes.slice(0, 12)) {
    const cust = customers.find((c) => c.id === q.customerId)!;
    await db.insert(s.messages).values({
      businessId: B, customerId: cust.id, quoteId: q.id, direction: "outbound", channel: "sms",
      body: `Hi ${cust.name.split(" ")[0]}, your ${q.title.toLowerCase()} quote from Cascade Green is ready to view.`,
      automated: true, createdAt: q.sentAt!,
    });
  }

  const recentActivity: Array<[string, string, number | null, number]> = [
    ["quote_accepted", "Sarah Miller accepted a $620 quote", 62000, 2],
    ["photos_uploaded", "Crew A uploaded 4 job photos", null, 8],
    ["payment_received", "Greg Nakamura paid invoice #1024", 48500, 14],
    ["lead_received", "New lead received from website", null, 21],
    ["job_completed", "Crew B completed Mulch Installation", 39500, 44],
    ["quote_sent", "Quote #1041 sent to Priya Raghavan", 87000, 68],
    ["review_received", "Thomas Reyes left a 5-star review", null, 96],
    ["job_started", "Crew A started Yard Cleanup", null, 132],
  ];
  activity.push(...recentActivity.map(([kind, summary, amt, minsAgo]) => ({
    businessId: B, kind, summary, amountCents: amt ?? undefined,
    actorUserId: owner.id, createdAt: new Date(now.getTime() - minsAgo * 6e4),
  })));
  await db.insert(s.activityEvents).values(activity);

  console.log(`  ${liveJobs.length} live jobs, automations + activity seeded`);
  console.log(`\nDemo login:  mike@cascadegreen.com  /  demo1234`);
  console.log(`Crew login:  luis@cascadegreen.com  /  demo1234`);
}

main()
  .then(async () => { await closeDb(); process.exit(0); })
  .catch(async (e) => { console.error(e); await closeDb().catch(() => {}); process.exit(1); });

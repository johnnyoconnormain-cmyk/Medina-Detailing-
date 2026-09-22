/**
 * Multi-tenant schema. Every tenant-scoped table carries `businessId`, and every
 * query path goes through the helpers in `lib/tenant.ts` so isolation is enforced
 * in one place rather than remembered at each call site.
 *
 * Money is ALWAYS integer cents. Never floats — $0.1 + $0.2 problems in an
 * invoicing product are unacceptable.
 */
import {
  pgTable, text, integer, timestamp, boolean, jsonb, uuid, pgEnum, index, uniqueIndex, real,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

/* ------------------------------------------------------------------ enums */

export const userRole = pgEnum("user_role", ["owner", "admin", "crew"]);
export const leadStatus = pgEnum("lead_status", ["new", "contacted", "quoted", "won", "lost", "archived"]);
export const leadSource = pgEnum("lead_source", ["website", "intake_form", "phone", "text", "email", "facebook", "instagram", "referral", "google", "repeat", "walk_by"]);
export const quoteStatus = pgEnum("quote_status", ["draft", "sent", "viewed", "accepted", "declined", "expired"]);
export const jobStatus = pgEnum("job_status", ["unscheduled", "scheduled", "in_progress", "complete", "cancelled"]);
export const invoiceStatus = pgEnum("invoice_status", ["draft", "sent", "paid", "overdue", "void"]);
export const paymentMethod = pgEnum("payment_method", ["card", "ach", "cash", "check", "other"]);
export const photoKind = pgEnum("photo_kind", ["before", "after", "progress", "issue", "lead"]);
export const crewStatus = pgEnum("crew_status", ["available", "working", "traveling", "off"]);
export const taskStatus = pgEnum("task_status", ["pending", "sent", "cancelled", "failed"]);
export const messageDirection = pgEnum("message_direction", ["inbound", "outbound"]);
export const messageChannel = pgEnum("message_channel", ["sms", "email", "call", "note"]);
export const planTier = pgEnum("plan_tier", ["starter", "pro", "scale"]);

/* ------------------------------------------------------------- businesses */

export const businesses = pgTable("businesses", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  phone: text("phone"),
  email: text("email"),
  addressLine: text("address_line"),
  city: text("city"),
  state: text("state"),
  postalCode: text("postal_code"),
  timezone: text("timezone").notNull().default("America/New_York"),
  plan: planTier("plan").notNull().default("pro"),
  logoUrl: text("logo_url"),
  // Pricing configuration the owner controls; every estimate reads from here.
  hourlyRateCents: integer("hourly_rate_cents").notNull().default(7500),
  minimumJobCents: integer("minimum_job_cents").notNull().default(15000),
  materialMarkupPct: real("material_markup_pct").notNull().default(20),
  travelFeeCents: integer("travel_fee_cents").notNull().default(0),
  taxRatePct: real("tax_rate_pct").notNull().default(0),
  // Working hours as minutes from midnight, per weekday (0=Sun).
  workingHours: jsonb("working_hours").$type<Record<string, { start: number; end: number } | null>>()
    .notNull().default({}),
  defaultJobBufferMin: integer("default_job_buffer_min").notNull().default(30),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("businesses_slug_idx").on(t.slug)]);

/* ------------------------------------------------------------ users/auth */

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  businessId: uuid("business_id").notNull().references(() => businesses.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  phone: text("phone"),
  role: userRole("role").notNull().default("crew"),
  avatarColor: text("avatar_color").notNull().default("#2a6746"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("users_email_idx").on(t.email), index("users_business_idx").on(t.businessId)]);

export const sessions = pgTable("sessions", {
  token: text("token").primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("sessions_user_idx").on(t.userId)]);

/* ------------------------------------------------------------------ crews */

export const crews = pgTable("crews", {
  id: uuid("id").primaryKey().defaultRandom(),
  businessId: uuid("business_id").notNull().references(() => businesses.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  color: text("color").notNull().default("#2a6746"),
  status: crewStatus("status").notNull().default("available"),
  // Last known position; nullable until a real GPS/maps provider is connected.
  lastLat: real("last_lat"),
  lastLng: real("last_lng"),
  lastPingAt: timestamp("last_ping_at", { withTimezone: true }),
  active: boolean("active").notNull().default(true),
}, (t) => [index("crews_business_idx").on(t.businessId)]);

export const crewMembers = pgTable("crew_members", {
  id: uuid("id").primaryKey().defaultRandom(),
  businessId: uuid("business_id").notNull().references(() => businesses.id, { onDelete: "cascade" }),
  crewId: uuid("crew_id").notNull().references(() => crews.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
}, (t) => [uniqueIndex("crew_member_unique").on(t.crewId, t.userId)]);

/* --------------------------------------------------------------- services */

export const services = pgTable("services", {
  id: uuid("id").primaryKey().defaultRandom(),
  businessId: uuid("business_id").notNull().references(() => businesses.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  // Estimate inputs the owner configures per service.
  basePriceCents: integer("base_price_cents").notNull().default(0),
  typicalHours: real("typical_hours").notNull().default(2),
  minPriceCents: integer("min_price_cents"),
  estimateLowPct: real("estimate_low_pct").notNull().default(85),
  estimateHighPct: real("estimate_high_pct").notNull().default(125),
  recurring: boolean("recurring").notNull().default(false),
  active: boolean("active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
}, (t) => [index("services_business_idx").on(t.businessId)]);

/* -------------------------------------------------------------- customers */

export const customers = pgTable("customers", {
  id: uuid("id").primaryKey().defaultRandom(),
  businessId: uuid("business_id").notNull().references(() => businesses.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  addressLine: text("address_line"),
  city: text("city"),
  state: text("state"),
  postalCode: text("postal_code"),
  lat: real("lat"),
  lng: real("lng"),
  notes: text("notes"),
  tags: jsonb("tags").$type<string[]>().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("customers_business_idx").on(t.businessId), index("customers_name_idx").on(t.name)]);

/* ------------------------------------------------------------------ leads */

export const leads = pgTable("leads", {
  id: uuid("id").primaryKey().defaultRandom(),
  businessId: uuid("business_id").notNull().references(() => businesses.id, { onDelete: "cascade" }),
  customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
  // Raw contact details as submitted, before a customer record exists.
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  addressLine: text("address_line"),
  city: text("city"),
  state: text("state"),
  postalCode: text("postal_code"),
  serviceId: uuid("service_id").references(() => services.id, { onDelete: "set null" }),
  requestText: text("request_text").notNull(),
  // Derived, not authored: filled by the classifier in lib/adapters/ai.
  summary: text("summary"),
  urgencyScore: integer("urgency_score"),
  preferredDate: text("preferred_date"),
  preferredWindow: text("preferred_window"),
  source: leadSource("source").notNull().default("website"),
  status: leadStatus("status").notNull().default("new"),
  estimateLowCents: integer("estimate_low_cents"),
  estimateHighCents: integer("estimate_high_cents"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("leads_business_status_idx").on(t.businessId, t.status)]);

/* ----------------------------------------------------------------- quotes */

export const quotes = pgTable("quotes", {
  id: uuid("id").primaryKey().defaultRandom(),
  businessId: uuid("business_id").notNull().references(() => businesses.id, { onDelete: "cascade" }),
  customerId: uuid("customer_id").notNull().references(() => customers.id, { onDelete: "cascade" }),
  leadId: uuid("lead_id").references(() => leads.id, { onDelete: "set null" }),
  number: integer("number").notNull(),
  // Unguessable token for the public quote page; never expose row ids publicly.
  publicToken: text("public_token").notNull(),
  title: text("title").notNull(),
  notes: text("notes"),
  status: quoteStatus("status").notNull().default("draft"),
  subtotalCents: integer("subtotal_cents").notNull().default(0),
  taxCents: integer("tax_cents").notNull().default(0),
  totalCents: integer("total_cents").notNull().default(0),
  validUntil: timestamp("valid_until", { withTimezone: true }),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  viewedAt: timestamp("viewed_at", { withTimezone: true }),
  respondedAt: timestamp("responded_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("quotes_token_idx").on(t.publicToken),
  uniqueIndex("quotes_number_idx").on(t.businessId, t.number),
  index("quotes_business_status_idx").on(t.businessId, t.status),
]);

export const quoteItems = pgTable("quote_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  businessId: uuid("business_id").notNull().references(() => businesses.id, { onDelete: "cascade" }),
  quoteId: uuid("quote_id").notNull().references(() => quotes.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  kind: text("kind").notNull().default("labor"), // labor | material | disposal | travel | other
  quantity: real("quantity").notNull().default(1),
  unitPriceCents: integer("unit_price_cents").notNull().default(0),
  totalCents: integer("total_cents").notNull().default(0),
  sortOrder: integer("sort_order").notNull().default(0),
}, (t) => [index("quote_items_quote_idx").on(t.quoteId)]);

/* ------------------------------------------------------------------- jobs */

export const jobs = pgTable("jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  businessId: uuid("business_id").notNull().references(() => businesses.id, { onDelete: "cascade" }),
  customerId: uuid("customer_id").notNull().references(() => customers.id, { onDelete: "cascade" }),
  quoteId: uuid("quote_id").references(() => quotes.id, { onDelete: "set null" }),
  crewId: uuid("crew_id").references(() => crews.id, { onDelete: "set null" }),
  number: integer("number").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  status: jobStatus("status").notNull().default("unscheduled"),
  scheduledStart: timestamp("scheduled_start", { withTimezone: true }),
  scheduledEnd: timestamp("scheduled_end", { withTimezone: true }),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  valueCents: integer("value_cents").notNull().default(0),
  addressLine: text("address_line"),
  city: text("city"),
  state: text("state"),
  postalCode: text("postal_code"),
  lat: real("lat"),
  lng: real("lng"),
  crewNotes: text("crew_notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("jobs_number_idx").on(t.businessId, t.number),
  index("jobs_business_status_idx").on(t.businessId, t.status),
  index("jobs_scheduled_idx").on(t.businessId, t.scheduledStart),
]);

export const jobChecklistItems = pgTable("job_checklist_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  businessId: uuid("business_id").notNull().references(() => businesses.id, { onDelete: "cascade" }),
  jobId: uuid("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  done: boolean("done").notNull().default(false),
  doneAt: timestamp("done_at", { withTimezone: true }),
  doneByUserId: uuid("done_by_user_id").references(() => users.id, { onDelete: "set null" }),
  sortOrder: integer("sort_order").notNull().default(0),
}, (t) => [index("checklist_job_idx").on(t.jobId)]);

export const jobPhotos = pgTable("job_photos", {
  id: uuid("id").primaryKey().defaultRandom(),
  businessId: uuid("business_id").notNull().references(() => businesses.id, { onDelete: "cascade" }),
  jobId: uuid("job_id").references(() => jobs.id, { onDelete: "cascade" }),
  leadId: uuid("lead_id").references(() => leads.id, { onDelete: "cascade" }),
  kind: photoKind("kind").notNull().default("before"),
  url: text("url").notNull(),
  caption: text("caption"),
  uploadedByUserId: uuid("uploaded_by_user_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("photos_job_idx").on(t.jobId), index("photos_lead_idx").on(t.leadId)]);

/* --------------------------------------------------------------- invoices */

export const invoices = pgTable("invoices", {
  id: uuid("id").primaryKey().defaultRandom(),
  businessId: uuid("business_id").notNull().references(() => businesses.id, { onDelete: "cascade" }),
  customerId: uuid("customer_id").notNull().references(() => customers.id, { onDelete: "cascade" }),
  jobId: uuid("job_id").references(() => jobs.id, { onDelete: "set null" }),
  number: integer("number").notNull(),
  publicToken: text("public_token").notNull(),
  status: invoiceStatus("status").notNull().default("draft"),
  subtotalCents: integer("subtotal_cents").notNull().default(0),
  taxCents: integer("tax_cents").notNull().default(0),
  totalCents: integer("total_cents").notNull().default(0),
  amountPaidCents: integer("amount_paid_cents").notNull().default(0),
  dueAt: timestamp("due_at", { withTimezone: true }),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("invoices_token_idx").on(t.publicToken),
  uniqueIndex("invoices_number_idx").on(t.businessId, t.number),
  index("invoices_business_status_idx").on(t.businessId, t.status),
]);

export const payments = pgTable("payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  businessId: uuid("business_id").notNull().references(() => businesses.id, { onDelete: "cascade" }),
  invoiceId: uuid("invoice_id").notNull().references(() => invoices.id, { onDelete: "cascade" }),
  amountCents: integer("amount_cents").notNull(),
  method: paymentMethod("method").notNull().default("card"),
  // Set by whichever payment provider the adapter is wired to.
  providerRef: text("provider_ref"),
  provider: text("provider").notNull().default("manual"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("payments_invoice_idx").on(t.invoiceId)]);

/* ---------------------------------------------------------------- reviews */

export const reviews = pgTable("reviews", {
  id: uuid("id").primaryKey().defaultRandom(),
  businessId: uuid("business_id").notNull().references(() => businesses.id, { onDelete: "cascade" }),
  customerId: uuid("customer_id").notNull().references(() => customers.id, { onDelete: "cascade" }),
  jobId: uuid("job_id").references(() => jobs.id, { onDelete: "set null" }),
  publicToken: text("public_token").notNull(),
  rating: integer("rating"),
  privateFeedback: text("private_feedback"),
  // True only when the customer was ROUTED to a public site — we never post for them.
  routedToPublic: boolean("routed_to_public").notNull().default(false),
  requestedAt: timestamp("requested_at", { withTimezone: true }),
  respondedAt: timestamp("responded_at", { withTimezone: true }),
}, (t) => [uniqueIndex("reviews_token_idx").on(t.publicToken)]);

/* ----------------------------------------------------- messages, activity */

export const messages = pgTable("messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  businessId: uuid("business_id").notNull().references(() => businesses.id, { onDelete: "cascade" }),
  customerId: uuid("customer_id").references(() => customers.id, { onDelete: "cascade" }),
  jobId: uuid("job_id").references(() => jobs.id, { onDelete: "set null" }),
  quoteId: uuid("quote_id").references(() => quotes.id, { onDelete: "set null" }),
  direction: messageDirection("direction").notNull(),
  channel: messageChannel("channel").notNull().default("sms"),
  body: text("body").notNull(),
  automated: boolean("automated").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("messages_customer_idx").on(t.customerId), index("messages_business_idx").on(t.businessId)]);

export const activityEvents = pgTable("activity_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  businessId: uuid("business_id").notNull().references(() => businesses.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  summary: text("summary").notNull(),
  entityType: text("entity_type"),
  entityId: uuid("entity_id"),
  amountCents: integer("amount_cents"),
  actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("activity_business_time_idx").on(t.businessId, t.createdAt)]);

/* ------------------------------------------------------------ automations */

export const automations = pgTable("automations", {
  id: uuid("id").primaryKey().defaultRandom(),
  businessId: uuid("business_id").notNull().references(() => businesses.id, { onDelete: "cascade" }),
  key: text("key").notNull(),            // new_lead | quote_accepted | quote_followup | job_complete | review_request
  name: text("name").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  // Ordered steps: [{ type: "wait", days }, { type: "message", channel, template }, ...]
  steps: jsonb("steps").$type<AutomationStep[]>().notNull().default([]),
}, (t) => [uniqueIndex("automations_key_idx").on(t.businessId, t.key)]);

export type AutomationStep =
  | { type: "wait"; days: number }
  | { type: "message"; channel: "sms" | "email"; template: string }
  | { type: "notify_owner"; template: string }
  | { type: "create_job" }
  | { type: "offer_times" }
  | { type: "send_invoice" }
  | { type: "request_review" };

/** Queue of future automation actions. A worker drains this; nothing fires inline. */
export const scheduledTasks = pgTable("scheduled_tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  businessId: uuid("business_id").notNull().references(() => businesses.id, { onDelete: "cascade" }),
  automationId: uuid("automation_id").references(() => automations.id, { onDelete: "cascade" }),
  automationKey: text("automation_key").notNull(),
  stepIndex: integer("step_index").notNull().default(0),
  entityType: text("entity_type").notNull(),
  entityId: uuid("entity_id").notNull(),
  runAt: timestamp("run_at", { withTimezone: true }).notNull(),
  status: taskStatus("status").notNull().default("pending"),
  lastError: text("last_error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("tasks_due_idx").on(t.status, t.runAt), index("tasks_entity_idx").on(t.entityType, t.entityId)]);

/* -------------------------------------------------------------- relations */

export const businessRelations = relations(businesses, ({ many }) => ({
  users: many(users), customers: many(customers), leads: many(leads),
  quotes: many(quotes), jobs: many(jobs), crews: many(crews), services: many(services),
}));

export const customerRelations = relations(customers, ({ one, many }) => ({
  business: one(businesses, { fields: [customers.businessId], references: [businesses.id] }),
  jobs: many(jobs), quotes: many(quotes), invoices: many(invoices), messages: many(messages),
}));

export const quoteRelations = relations(quotes, ({ one, many }) => ({
  customer: one(customers, { fields: [quotes.customerId], references: [customers.id] }),
  lead: one(leads, { fields: [quotes.leadId], references: [leads.id] }),
  items: many(quoteItems),
}));

export const jobRelations = relations(jobs, ({ one, many }) => ({
  customer: one(customers, { fields: [jobs.customerId], references: [customers.id] }),
  crew: one(crews, { fields: [jobs.crewId], references: [crews.id] }),
  quote: one(quotes, { fields: [jobs.quoteId], references: [quotes.id] }),
  checklist: many(jobChecklistItems), photos: many(jobPhotos),
}));

export const invoiceRelations = relations(invoices, ({ one, many }) => ({
  customer: one(customers, { fields: [invoices.customerId], references: [customers.id] }),
  job: one(jobs, { fields: [invoices.jobId], references: [jobs.id] }),
  payments: many(payments),
}));

export const leadRelations = relations(leads, ({ one, many }) => ({
  customer: one(customers, { fields: [leads.customerId], references: [customers.id] }),
  service: one(services, { fields: [leads.serviceId], references: [services.id] }),
  photos: many(jobPhotos),
}));

export const crewRelations = relations(crews, ({ many }) => ({ jobs: many(jobs), members: many(crewMembers) }));

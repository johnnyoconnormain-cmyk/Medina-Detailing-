# YardOps

An operating system for small home-service businesses, built first for landscaping
companies with 3–15 employees.

It carries a customer along one unbroken line — **lead → quote → accept → schedule →
complete → pay → review** — so nothing gets retyped and nothing falls through. That
whole loop works end to end today; everything else in the app exists to support it.

## Running it

```bash
npm install
npm run db:push      # create the schema
npm run db:seed      # load a full demo company
npm run dev          # database + app together on :3000
```

Then sign in:

| Role  | Email                    | Password   |
|-------|--------------------------|------------|
| Owner | `mike@cascadegreen.com`  | `demo1234` |
| Crew  | `luis@cascadegreen.com`  | `demo1234` |

`npm run dev` starts two processes: the local database and Next. `npm run db:reset`
wipes and reseeds.

## Deploying

Deploys to Vercel with no configuration. It needs a hosted Postgres, and that is
the only setup step:

1. Vercel project → **Storage** → add **Neon** or **Supabase**. Either sets
   `DATABASE_URL`. Use the **pooled** connection string — serverless runs many
   instances, each with its own pool.
2. Redeploy.

**No migration command is needed.** The app creates its schema on first contact
with an empty database, serialised by a Postgres advisory lock so concurrent
cold starts cannot race, and recorded in a `__migrations` ledger so it happens
once. DDL is transactional in Postgres, so a failure leaves the database
untouched rather than half-built.

Set `APP_URL` to the deployed origin so customer-facing links in messages are
absolute.

Photo uploads need object storage in production, since serverless filesystems
are read-only. Without it the upload button says so and the rest of the job flow
is unaffected — add Vercel Blob, S3 or Supabase Storage behind `StorageProvider`
in `lib/adapters/storage.ts`.


## The database decision

Local development runs **PGlite** — real PostgreSQL 18 compiled to WebAssembly —
served over the Postgres wire protocol on `127.0.0.1:5433`. So:

* there is no Postgres to install, and no Docker;
* the app talks ordinary Postgres to a connection string, exactly as it will to
  Supabase or RDS;
* migrating to hosted Postgres is setting `DATABASE_URL`. The schema, the queries
  and the migrations do not change.

The socket server exists for a specific reason. Embedded PGlite holds an exclusive
lock on its data directory, so a second process opening it aborts the WASM engine —
the dev server and the seed script would fight over it. Serving it over a socket
lets every process connect normally.

One caveat is encoded in `src/db/client.ts`: that socket server multiplexes all
connections onto a *single* engine, so concurrent extended-protocol queries clobber
each other's unnamed prepared statement. The local pool is therefore capped at one
connection. A real Postgres has no such limit, and the cap lifts automatically when
`DATABASE_URL` points somewhere that isn't localhost.

## Multi-tenancy

Every tenant-scoped table carries `businessId`. Server components and actions get it
from exactly one place — `requireCtx()` in `src/lib/tenant.ts` — which reads it from
a verified session. It is never accepted from a URL parameter, a form field, or
anything else a client controls. The public pages (quote, pay, review, intake) are
reached by unguessable tokens and resolve the business from the token or slug, never
from client input.

## What is real, and what is a seam

Working for real: authentication and sessions, the full lead→paid loop, the
automation queue, photo upload to disk, quote and invoice public pages, the command
palette and global search, analytics computed from actual rows.

Deliberately left as interfaces rather than faked, because a plausible-looking lie is
worse than an empty panel:

| Seam | State | To switch on |
|---|---|---|
| `adapters/payments.ts` | Records real payments; moves no money | `STRIPE_SECRET_KEY` + a webhook route calling `settle()` |
| `adapters/messaging.ts` | Messages are stored in customer history, not transmitted | Twilio or Resend behind `send()` |
| `adapters/maps.ts` | Returns nothing; the HUD says the map is not connected | `MAPBOX_TOKEN` or `GOOGLE_MAPS_KEY` |
| `adapters/weather.ts` | Returns nothing; the panel says so | `WEATHER_API_KEY` |
| `adapters/ai.ts` | Deterministic keyword analysis | Implement the same interface with a model |

The last one is a choice, not a placeholder. Lead classification, urgency scoring and
follow-up drafting run on keyword analysis that works offline, costs nothing, returns
the same answer twice, and can be explained to an owner who asks why a lead was
flagged urgent. `confidence` is reported honestly so the UI stays quiet when the
signal is weak. Swapping in a model means implementing `IntelligenceProvider`; no
caller changes.

## Estimates

The estimate range is arithmetic over the owner's own configured rates — hourly rate
× typical hours, plus base price, plus material markup, plus travel, floored at the
job minimum, widened by the owner's low/high percentages, rounded to the nearest $25
so it reads as an estimate rather than false precision. The customer is always told
the final price is confirmed on inspection, and the owner can override every line.

## Money

Integer cents everywhere. `src/lib/money.ts` holds the only conversions to and from
strings. A float rounding error in an invoicing product is not acceptable.

## Notes for whoever works on this next

**Correlated subqueries use literal table names, not `${table.column}`.** Drizzle's
interpolation emits a *bare* column (`"id"`), which inside a subquery binds to the
inner table and silently makes the correlation a no-op — `j.customer_id = j.id`,
always false, always zero. This shipped as a bug that showed a customer with 18 jobs
as having 0. Write `where j.customer_id = customers.id` explicitly.

**The customer-facing accept and pay buttons are real `<form>` submissions**, not
click handlers. They work before React hydrates and with JavaScript disabled. These
are the two points where the business gets paid; they should not depend on a bundle
finishing downloading on a phone in someone's driveway.

**Automations never fire inline.** Triggering one writes a row to `scheduled_tasks`
with a `runAt`. A worker drains due rows, so a restart never loses a follow-up, and a
customer clicking "accept" never waits on work scheduled for three days' time. A
sequence cancels itself the moment the customer responds.

**The HUD computes everything from rows.** No dashboard number is hard-coded. Where
there isn't enough data to say something true — an insight with too small a sample,
a week-over-week comparison with no baseline — it says so instead of showing a zero.
Week-to-date is compared against the *same elapsed slice* of last week, so Monday
morning doesn't report a 90% collapse.

## Layout

```
src/
  app/
    (app)/       authenticated: dashboard, leads, quotes, schedule, jobs,
                 customers, invoices, analytics, automations, settings, crew
    (auth)/      login, signup
    q/[token]/       public quote page
    pay/[token]/     public payment page
    review/[token]/  public review page
    intake/[slug]/   public request form
  actions/       server actions (auth, leads, quotes, jobs, invoices, intake, settings, search)
  components/    ui primitives, app shell, HUD panels, job widgets
  db/            schema, client, migrations, seed
  lib/           tenant, session, money, estimate, adapters, automations, queries
```

## Stack

Next.js 15 (App Router, server actions) · TypeScript · Tailwind · Drizzle ORM ·
PostgreSQL via PGlite locally. No UI framework and no chart library — the charts are
hand-rolled SVG so the visual language stays consistent and the bundle stays small.

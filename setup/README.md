# Setting up the database (no terminal needed)

The app is deployed but needs somewhere to store data. Postgres is required —
Convex, Firebase and similar document databases will not work, because the app
uses SQL tables, joins and aggregate queries.

## Steps

1. **Add Postgres in Vercel.**
   Your project → **Storage** → **Neon** (or Supabase). Either one sets
   `DATABASE_URL` for you automatically. Pick the **pooled** connection string
   if you're offered a choice.

2. **Create the tables.**
   Open your database's SQL editor in the browser:
   - Neon: your project → **SQL Editor**
   - Supabase: your project → **SQL Editor** → **New query**

   Copy the whole of [`01-schema.sql`](01-schema.sql), paste it in, and run it.
   That's the entire setup — 20 tables.

3. **Redeploy.** Vercel redeploys automatically when the environment variable
   changes. If it doesn't, hit Redeploy on the latest deployment.

4. **Open the site and click "Start free."** That creates your company with
   starter services, a crew and the default automations already switched on.

## Optional: load the demo company

If you'd rather look around a business that already has history in it —
customers, leads, quotes, jobs, invoices, payments — run
[`02-demo-data.sql`](02-demo-data.sql) in the same SQL editor after step 2,
then sign in with:

    mike@cascadegreen.com  /  demo1234

Skip this if you're setting up for real use; it's sample data.

## If you do have a terminal

The same thing, from a local checkout:

```bash
DATABASE_URL="postgres://…" npm run db:deploy        # creates the tables
DATABASE_URL="postgres://…" npm run db:deploy:seed   # optional demo data
```

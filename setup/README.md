# Setting up the database

**You should not need to run any SQL.** The app creates its own tables the first
time it talks to a database, so the whole setup is:

1. In your Vercel project → **Storage** → **Create Database** → **Neon** → Create.
   That sets `DATABASE_URL` automatically.
2. **Deployments** → top one → **⋯** → **Redeploy**.
3. Open the site → **Start free** → make your account.

That's it. On the first request the app takes a Postgres advisory lock, creates
all 20 tables, records the migration, and releases. Subsequent boots cost one
cheap lookup.

Postgres is genuinely required. Convex, Firebase and other document databases
will not work — the app uses SQL tables, joins and aggregate queries throughout.

## If something goes wrong

`01-schema.sql` in this folder is the same schema as a plain file, in case you
ever want to create it by hand in a SQL editor. You shouldn't need it.

## Demo data (optional)

A signup gives you an empty company, which is the right starting point for real
use. If you'd rather explore one with history in it, run this from a local
checkout:

```bash
DATABASE_URL="postgres://…" npm run db:deploy:seed
```

Then sign in with `mike@cascadegreen.com` / `demo1234`.

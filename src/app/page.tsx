import type { Metadata } from "next";
import Link from "next/link";
import { PLANS } from "@/lib/plans";

export const metadata: Metadata = {
  title: "YardOps — Run your landscaping business from one place",
  description: "Turn leads into booked jobs, automate follow-ups, manage your crew, collect payments, and keep every customer in one system.",
};

const FEATURES = [
  { k: "Lead management", h: "Every request in one inbox",
    p: "Website forms, texts, phone calls and Instagram DMs all land in the same place, tagged and sized, so nothing sits unanswered for three days." },
  { k: "Instant quoting", h: "Quote from the driveway",
    p: "Pull up a service, adjust the lines, send. The customer gets a clean page with one button on it, and you get told the moment they open it." },
  { k: "Follow-ups", h: "The money is in the second text",
    p: "Most quotes aren't lost, they're forgotten. Sequences chase them for you and stop the second the customer replies." },
  { k: "Scheduling", h: "A week you can actually read",
    p: "Accepted quotes become jobs waiting for a date. Assign a crew, set the hours, done — and the crew sees it on their phone." },
  { k: "Crew management", h: "Built for a phone in a work glove",
    p: "Today's stops, the gate code, one tap to navigate or call, a checklist, and before/after photos that double as marketing." },
  { k: "Payments", h: "Invoice the second the job closes",
    p: "Marking a job complete raises the invoice and texts the payment link. No Friday night catching up on billing." },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b backdrop-blur"
              style={{ borderColor: "rgb(var(--border))", background: "rgb(var(--bg) / 0.9)" }}>
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <span className="flex h-7 w-7 items-center justify-center rounded bg-moss-600 text-xs font-bold text-white">Y</span>
          <span className="flex-1 text-sm font-semibold tracking-tight">YardOps</span>
          <Link href="#pricing" className="hidden text-xs font-medium text-muted hover:text-[rgb(var(--text))] sm:block">Pricing</Link>
          <Link href="/login" className="text-xs font-medium text-muted hover:text-[rgb(var(--text))]">Sign in</Link>
          <Link href="/signup" className="btn btn-primary !px-3 !py-1.5 text-xs">Start free</Link>
        </div>
      </header>

      {/* hero */}
      <section className="mx-auto max-w-6xl px-4 pb-14 pt-16 sm:pb-20 sm:pt-24">
        <p className="label-xs mb-4">Built for landscaping crews of 3–15</p>
        <h1 className="max-w-3xl text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
          Run your landscaping business from one place.
        </h1>
        <p className="mt-5 max-w-xl text-base leading-relaxed text-muted sm:text-lg">
          Turn leads into booked jobs, automate follow-ups, manage your crew, collect
          payments, and keep every customer in one system.
        </p>
        <div className="mt-7 flex flex-wrap gap-2.5">
          <Link href="/signup" className="btn btn-primary !px-5 !py-2.5">Start free</Link>
          <Link href="/login" className="btn btn-secondary !px-5 !py-2.5">See how it works</Link>
        </div>
        <p className="mt-3 text-xs text-faint">
          No card required. A full demo company is already loaded, so there&apos;s nothing to set up before you can look around.
        </p>

        {/* the actual pipeline, not a stock illustration */}
        <div className="card mt-12 overflow-hidden">
          <div className="flex items-center gap-2 border-b px-4 py-2.5" style={{ borderColor: "rgb(var(--border))" }}>
            <span className="h-2 w-2 rounded-full bg-clay-400" />
            <span className="h-2 w-2 rounded-full bg-bark-300 dark:bg-bark-600" />
            <span className="h-2 w-2 rounded-full bg-bark-300 dark:bg-bark-600" />
            <span className="ml-2 text-2xs text-faint">Command center</span>
          </div>
          <div className="grid grid-cols-2 divide-x divide-y sm:grid-cols-3 lg:grid-cols-6 lg:divide-y-0"
               style={{ borderColor: "rgb(var(--border))" }}>
            {[
              { l: "Leads", v: "12", s: "" }, { l: "Quotes", v: "8", s: "$4,820" },
              { l: "Booked", v: "14", s: "$7,240" }, { l: "Today", v: "6", s: "$2,180" },
              { l: "Complete", v: "4", s: "" }, { l: "Paid", v: "9", s: "$1,840" },
            ].map((c) => (
              <div key={c.l} className="px-4 py-3.5" style={{ borderColor: "rgb(var(--border))" }}>
                <p className="label-xs">{c.l}</p>
                <p className="tnum mt-1 text-xl font-semibold tracking-tight">{c.v}</p>
                <p className="tnum mt-0.5 text-2xs text-muted">{c.s || " "}</p>
              </div>
            ))}
          </div>
          <div className="border-t px-4 py-3" style={{ borderColor: "rgb(var(--border))" }}>
            <p className="text-xs text-muted">
              <span className="font-semibold text-[rgb(var(--text))]">Needs your attention:</span>{" "}
              3 quotes haven&apos;t been followed up — $2,430 sitting there.
            </p>
          </div>
        </div>
      </section>

      {/* features */}
      <section className="border-t py-16 sm:py-20" style={{ borderColor: "rgb(var(--border))" }}>
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="max-w-2xl text-2xl font-semibold tracking-tight sm:text-3xl">
            The whole job, start to paid.
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted">
            Not another app to check. One system that carries a customer from the first
            text to the review, so nothing needs retyping and nothing falls through.
          </p>

          <div className="mt-10 grid gap-x-8 gap-y-9 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.k}>
                <p className="label-xs mb-2">{f.k}</p>
                <h3 className="text-base font-semibold tracking-tight">{f.h}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{f.p}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* the loop */}
      <section className="border-t py-16 sm:py-20" style={{ borderColor: "rgb(var(--border))" }}>
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">One unbroken line</h2>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted">
            Each step hands off to the next automatically. Accepting a quote creates the job.
            Completing the job raises the invoice. Paying the invoice asks for the review.
          </p>
          <ol className="mt-9 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { n: "01", t: "Lead arrives", d: "From your intake link, a call, or a DM. Sized and tagged on the way in." },
              { n: "02", t: "Quote goes out", d: "Built from your own rates. The customer gets one page and one button." },
              { n: "03", t: "Crew does the work", d: "Scheduled, assigned, checklisted, photographed — from a phone." },
              { n: "04", t: "You get paid", d: "Invoice on completion, payment link by text, review request after." },
            ].map((s) => (
              <li key={s.n} className="card p-4">
                <p className="tnum text-2xs font-bold text-moss-600 dark:text-moss-400">{s.n}</p>
                <h3 className="mt-1.5 text-sm font-semibold">{s.t}</h3>
                <p className="mt-1 text-xs leading-relaxed text-muted">{s.d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* pricing */}
      <section id="pricing" className="border-t py-16 sm:py-20" style={{ borderColor: "rgb(var(--border))" }}>
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Pricing</h2>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted">
            One job a month covers it. Cancel whenever — your data exports on the way out.
          </p>

          <div className="mt-9 grid gap-4 lg:grid-cols-3">
            {PLANS.map((p) => (
              <div key={p.id}
                   className={`card flex flex-col p-5 ${p.highlight ? "ring-2 ring-moss-600 dark:ring-moss-500" : ""}`}>
                {p.highlight && <p className="label-xs mb-2 text-moss-600 dark:text-moss-400">Most popular</p>}
                <h3 className="text-base font-semibold">{p.name}</h3>
                <p className="mt-0.5 text-xs text-muted">{p.tagline}</p>
                <p className="mt-4 flex items-baseline gap-1">
                  <span className="tnum text-3xl font-semibold tracking-tight">${p.priceMonthly}</span>
                  <span className="text-xs text-muted">/month</span>
                </p>
                <ul className="mt-5 flex-1 space-y-2">
                  {p.features.map((f) => (
                    <li key={f} className="flex gap-2 text-xs leading-relaxed">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                           strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
                           className="mt-0.5 flex-none text-moss-600 dark:text-moss-400">
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                      {f}
                    </li>
                  ))}
                </ul>
                <Link href="/signup"
                      className={`btn mt-5 w-full ${p.highlight ? "btn-primary" : "btn-secondary"}`}>
                  Start free
                </Link>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-faint">
            Billing isn&apos;t switched on yet — signing up creates a full working account, and no card is collected.
          </p>
        </div>
      </section>

      <footer className="border-t py-10" style={{ borderColor: "rgb(var(--border))" }}>
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4">
          <span className="flex items-center gap-2 text-sm font-semibold">
            <span className="flex h-6 w-6 items-center justify-center rounded bg-moss-600 text-2xs font-bold text-white">Y</span>
            YardOps
          </span>
          <span className="text-xs text-faint">The operating system for small service businesses.</span>
          <span className="ml-auto flex gap-4 text-xs">
            <Link href="/login" className="text-muted hover:text-[rgb(var(--text))]">Sign in</Link>
            <Link href="/signup" className="text-muted hover:text-[rgb(var(--text))]">Start free</Link>
          </span>
        </div>
      </footer>
    </div>
  );
}

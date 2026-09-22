import type { Metadata } from "next";
import { requireCtx } from "@/lib/tenant";
import { db } from "@/db/client";
import { and, eq, asc } from "drizzle-orm";
import { services, users, crews } from "@/db/schema";
import { TopBar } from "@/components/shell/TopBar";
import { Card, SectionHeader, Avatar, Chip } from "@/components/ui/primitives";
import { CopyLink } from "@/components/ui/CopyLink";
import { PricingForm, BusinessForm } from "./Forms";
import { fmtMoney } from "@/lib/money";
import { getPaymentProvider } from "@/lib/adapters/payments";
import { getMessaging } from "@/lib/adapters/messaging";
import { getIntelligence } from "@/lib/adapters/ai";
import { getStorage } from "@/lib/adapters/storage";
import { isMapAvailable } from "@/lib/adapters/maps";
import { isWeatherAvailable } from "@/lib/adapters/weather";
import { logoutAction } from "@/actions/auth";

export const metadata: Metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const ctx = await requireCtx();

  const [svc, team, crewRows] = await Promise.all([
    db.select().from(services).where(eq(services.businessId, ctx.businessId)).orderBy(asc(services.sortOrder)),
    db.select().from(users).where(eq(users.businessId, ctx.businessId)).orderBy(asc(users.name)),
    db.select().from(crews).where(eq(crews.businessId, ctx.businessId)).orderBy(asc(crews.name)),
  ]);

  const integrations = [
    { name: "Payments", detail: getPaymentProvider().name, live: getPaymentProvider().live,
      hint: "Set STRIPE_SECRET_KEY and add the webhook route to take cards." },
    { name: "Messaging", detail: getMessaging().name, live: getMessaging().live,
      hint: "Messages are recorded in each customer's history but not transmitted. Connect Twilio or Resend to send." },
    { name: "Lead analysis", detail: getIntelligence().name, live: true,
      hint: "Deterministic keyword analysis — runs offline, costs nothing, gives the same answer twice." },
    { name: "Photo storage", detail: getStorage().name, live: getStorage().available,
      hint: "Local disk in development. A serverless deployment needs object storage (Vercel Blob, S3, Supabase Storage)." },
    { name: "Maps", detail: isMapAvailable() ? "configured" : "not connected", live: isMapAvailable(),
      hint: "Set MAPBOX_TOKEN or GOOGLE_MAPS_KEY for routing and crew locations." },
    { name: "Weather", detail: isWeatherAvailable() ? "configured" : "not connected", live: isWeatherAvailable(),
      hint: "Set WEATHER_API_KEY to flag jobs at risk of rain." },
  ];

  return (
    <>
      <TopBar title="Settings" subtitle={ctx.business.name} />

      <main className="mx-auto w-full max-w-[900px] flex-1 space-y-3 p-3 sm:p-4">
        <Card>
          <SectionHeader title="Pricing rules" />
          <p className="px-4 pb-1 text-xs text-muted">
            Every estimate and quote starts from these numbers. Nothing is guessed — change a rate here
            and every future estimate moves with it.
          </p>
          <PricingForm
            hourlyRate={(ctx.business.hourlyRateCents / 100).toFixed(2)}
            minimumJob={(ctx.business.minimumJobCents / 100).toFixed(2)}
            travelFee={(ctx.business.travelFeeCents / 100).toFixed(2)}
            materialMarkup={String(ctx.business.materialMarkupPct)}
            taxRate={String(ctx.business.taxRatePct)}
          />
        </Card>

        <Card>
          <SectionHeader title="Customer intake link" />
          <div className="px-4 pb-4">
            <p className="mb-2 text-xs text-muted">
              Put this on your website, in your Instagram bio, or text it to someone who calls.
              Submissions land straight in your lead inbox.
            </p>
            <CopyLink path={`/intake/${ctx.business.slug}`} />
          </div>
        </Card>

        <Card>
          <SectionHeader title="Business details" />
          <BusinessForm
            name={ctx.business.name} phone={ctx.business.phone ?? ""} email={ctx.business.email ?? ""}
            addressLine={ctx.business.addressLine ?? ""} city={ctx.business.city ?? ""}
            state={ctx.business.state ?? ""} postalCode={ctx.business.postalCode ?? ""}
          />
        </Card>

        <Card className="overflow-hidden">
          <SectionHeader title="Services" count={svc.length} />
          <ul className="divide-y" style={{ borderColor: "rgb(var(--border))" }}>
            {svc.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5">
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="text-sm font-medium">{s.name}</span>
                    {s.recurring && <Chip tone="info">recurring</Chip>}
                  </span>
                  {s.description && <span className="block truncate text-2xs text-muted">{s.description}</span>}
                </span>
                <span className="tnum text-2xs text-faint">{s.typicalHours}h typical</span>
                <span className="tnum w-20 text-right text-xs">
                  {s.basePriceCents > 0 ? fmtMoney(s.basePriceCents) : "—"}
                </span>
                <span className="tnum w-20 text-right text-2xs text-faint">
                  min {s.minPriceCents ? fmtMoney(s.minPriceCents) : "—"}
                </span>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="overflow-hidden">
          <SectionHeader title="Team" count={team.length} />
          <ul className="divide-y" style={{ borderColor: "rgb(var(--border))" }}>
            {team.map((u) => (
              <li key={u.id} className="flex items-center gap-3 px-4 py-2.5">
                <Avatar name={u.name} color={u.avatarColor} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{u.name}</span>
                  <span className="block truncate text-2xs text-muted">{u.email}</span>
                </span>
                <Chip tone={u.role === "owner" ? "success" : "neutral"}>{u.role}</Chip>
              </li>
            ))}
          </ul>
          <div className="border-t px-4 py-2.5" style={{ borderColor: "rgb(var(--border))" }}>
            <p className="text-2xs text-faint">
              {crewRows.length} crew{crewRows.length === 1 ? "" : "s"}: {crewRows.map((c) => c.name).join(", ")}
            </p>
          </div>
        </Card>

        <Card className="overflow-hidden">
          <SectionHeader title="Integrations" />
          <ul className="divide-y" style={{ borderColor: "rgb(var(--border))" }}>
            {integrations.map((i) => (
              <li key={i.name} className="px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="flex-1 text-sm font-medium">{i.name}</span>
                  <Chip tone={i.live ? "success" : "neutral"}>{i.live ? "active" : "not connected"}</Chip>
                  <span className="text-2xs text-faint">{i.detail}</span>
                </div>
                <p className="mt-0.5 text-2xs leading-relaxed text-muted">{i.hint}</p>
              </li>
            ))}
          </ul>
        </Card>

        <div className="flex justify-end pb-4">
          <form action={logoutAction}>
            <button className="btn btn-ghost border border-[rgb(var(--border))] text-xs">Sign out</button>
          </form>
        </div>
      </main>
    </>
  );
}

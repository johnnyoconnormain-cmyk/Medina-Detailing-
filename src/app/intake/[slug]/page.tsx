import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/db/client";
import { ensureSchema } from "@/db/auto-migrate";
import { and, eq, asc } from "drizzle-orm";
import { businesses, services } from "@/db/schema";
import { IntakeForm } from "./IntakeForm";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const [biz] = await db.select().from(businesses).where(eq(businesses.slug, slug)).limit(1);
  return { title: biz ? `Request a quote · ${biz.name}` : "Request a quote" };
}

export default async function IntakePage({ params }: { params: Promise<{ slug: string }> }) {
  await ensureSchema();
  const { slug } = await params;
  const [biz] = await db.select().from(businesses).where(eq(businesses.slug, slug)).limit(1);
  if (!biz) notFound();

  const svc = await db.select().from(services)
    .where(and(eq(services.businessId, biz.id), eq(services.active, true)))
    .orderBy(asc(services.sortOrder));

  return (
    <main className="mx-auto w-full max-w-md px-4 py-8 sm:py-14">
      <div className="mb-7 flex items-center gap-2.5">
        <span className="flex h-10 w-10 items-center justify-center rounded bg-moss-600 text-base font-bold text-white">
          {biz.name.charAt(0)}
        </span>
        <div>
          <p className="text-sm font-semibold leading-tight">{biz.name}</p>
          {biz.phone && <p className="tnum text-xs text-muted">{biz.phone}</p>}
        </div>
      </div>

      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Tell us about your yard</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        Takes about a minute. Add a couple of photos and we can usually give you a ballpark
        before we even come out.
      </p>

      <IntakeForm
        slug={slug}
        businessName={biz.name}
        services={svc.map((s) => ({ id: s.id, name: s.name }))}
      />

      <footer className="mt-10 border-t pt-4 text-center text-2xs text-faint" style={{ borderColor: "rgb(var(--border))" }}>
        <p>{biz.name}{biz.city ? ` · ${biz.city}, ${biz.state}` : ""}</p>
        <p className="mt-1">Powered by YardOps</p>
      </footer>
    </main>
  );
}

import { requireCtx } from "@/lib/tenant";
import { db } from "@/db/client";
import { and, eq, inArray, sql } from "drizzle-orm";
import { leads, quotes, invoices } from "@/db/schema";
import { Sidebar } from "@/components/shell/Nav";
import { CommandPalette } from "@/components/shell/CommandPalette";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireCtx();
  const B = ctx.businessId;

  const [leadCount, quoteCount, unpaidCount] = await Promise.all([
    db.select({ n: sql<number>`count(*)::int` }).from(leads)
      .where(and(eq(leads.businessId, B), eq(leads.status, "new"))),
    db.select({ n: sql<number>`count(*)::int` }).from(quotes)
      .where(and(eq(quotes.businessId, B), inArray(quotes.status, ["sent", "viewed"]))),
    db.select({ n: sql<number>`count(*)::int` }).from(invoices)
      .where(and(eq(invoices.businessId, B), inArray(invoices.status, ["sent", "overdue"]))),
  ]);

  return (
    <div className="flex min-h-screen">
      <Sidebar
        counts={{ leads: leadCount[0]?.n ?? 0, quotes: quoteCount[0]?.n ?? 0, unpaid: unpaidCount[0]?.n ?? 0 }}
        user={{ name: ctx.user.name, role: ctx.user.role, avatarColor: ctx.user.avatarColor }}
        business={{ name: ctx.business.name }}
      />
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
      <CommandPalette />
    </div>
  );
}

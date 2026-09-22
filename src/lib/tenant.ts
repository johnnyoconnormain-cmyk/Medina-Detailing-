import "server-only";
import { redirect } from "next/navigation";
import { getSession, type SessionUser, type SessionBusiness } from "./session";

export type Ctx = { user: SessionUser; business: SessionBusiness; businessId: string };

/**
 * The single entry point for every authenticated server component and action.
 *
 * Tenant isolation depends on `ctx.businessId` being threaded into each query's
 * WHERE clause. Centralising acquisition here means there is exactly one place
 * a business id can come from, and it can only come from a verified session —
 * never from a URL parameter or form field a client controls.
 */
export async function requireCtx(): Promise<Ctx> {
  const s = await getSession();
  if (!s) redirect("/login");
  return { user: s.user, business: s.business, businessId: s.user.businessId };
}

export async function requireOwner(): Promise<Ctx> {
  const ctx = await requireCtx();
  if (ctx.user.role === "crew") redirect("/crew");
  return ctx;
}

/** Throws rather than redirects — for server actions, where a redirect would be swallowed. */
export async function requireCtxOrThrow(): Promise<Ctx> {
  const s = await getSession();
  if (!s) throw new Error("Not authenticated");
  return { user: s.user, business: s.business, businessId: s.user.businessId };
}

import "server-only";
import { cookies } from "next/headers";
import { eq, and, gt } from "drizzle-orm";
import { db } from "@/db/client";
import { sessions, users, businesses } from "@/db/schema";
import { SESSION_COOKIE, SESSION_TTL_DAYS, newToken } from "./auth";
import { ensureSchema } from "@/db/auto-migrate";
import { cache } from "react";

export type SessionUser = {
  id: string; businessId: string; email: string; name: string;
  role: "owner" | "admin" | "crew"; avatarColor: string;
};
export type SessionBusiness = typeof businesses.$inferSelect;

export async function createSession(userId: string) {
  const token = newToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 864e5);
  await db.insert(sessions).values({ token, userId, expiresAt });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production",
    path: "/", expires: expiresAt,
  });
  return token;
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.delete(sessions).where(eq(sessions.token, token));
  jar.delete(SESSION_COOKIE);
}

/**
 * Deduped per request so a page with a dozen server components doesn't run a
 * dozen identical session lookups.
 */
export const getSession = cache(async (): Promise<{ user: SessionUser; business: SessionBusiness } | null> => {
  // First call on a cold instance creates the schema if the database is empty,
  // so a fresh deployment needs nothing but a DATABASE_URL. No-op afterwards.
  await ensureSchema();

  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const rows = await db
    .select({ user: users, business: businesses })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .innerJoin(businesses, eq(users.businessId, businesses.id))
    .where(and(eq(sessions.token, token), gt(sessions.expiresAt, new Date())))
    .limit(1);

  const row = rows[0];
  if (!row || !row.user.active) return null;

  return {
    user: {
      id: row.user.id, businessId: row.user.businessId, email: row.user.email,
      name: row.user.name, role: row.user.role, avatarColor: row.user.avatarColor,
    },
    business: row.business,
  };
});

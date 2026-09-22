import { randomBytes, scrypt as _scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(_scrypt) as (p: string, s: Buffer, k: number) => Promise<Buffer>;
const KEYLEN = 64;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, KEYLEN);
  return `scrypt$${salt.toString("hex")}$${key.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algo, saltHex, keyHex] = stored.split("$");
  if (algo !== "scrypt" || !saltHex || !keyHex) return false;
  const key = await scrypt(password, Buffer.from(saltHex, "hex"), KEYLEN);
  const expected = Buffer.from(keyHex, "hex");
  // Constant-time compare; length check first since timingSafeEqual throws on mismatch.
  return key.length === expected.length && timingSafeEqual(key, expected);
}

export function newToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

/** Short, human-speakable token for public quote/invoice links. */
export function newPublicToken(): string {
  return randomBytes(9).toString("base64url");
}

export const SESSION_COOKIE = "yardops_session";
export const SESSION_TTL_DAYS = 30;

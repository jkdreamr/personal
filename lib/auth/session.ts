import crypto from "node:crypto";
import { serverEnv } from "@/lib/env";
import { SESSION_COOKIE, SESSION_TTL_MS } from "./constants";

/**
 * Private-beta session as a signed cookie. No database, no account.
 * The cookie payload is `{exp}` signed with HMAC-SHA256 over the session secret.
 * Access-code comparison is timing-safe.
 */

export { SESSION_COOKIE };

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function sign(payload: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("base64url");
}

/** Constant-time comparison that also resists length leaks. */
export function timingSafeEqualStr(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  // Hash both to equal-length digests so timingSafeEqual never throws on length mismatch.
  const ha = crypto.createHash("sha256").update(ab).digest();
  const hb = crypto.createHash("sha256").update(bb).digest();
  const equal = crypto.timingSafeEqual(ha, hb);
  return equal && a.length === b.length;
}

export function verifyAccessCode(submitted: string): boolean {
  const expected = serverEnv.betaAccessCode;
  if (!expected) return false;
  return timingSafeEqualStr(submitted.trim(), expected);
}

export function createSessionToken(secret = serverEnv.betaSessionSecret): string {
  const payload = JSON.stringify({ exp: Date.now() + SESSION_TTL_MS, v: 1 });
  const body = b64url(payload);
  const sig = sign(body, secret);
  return `${body}.${sig}`;
}

export function verifySessionToken(token: string | undefined, secret = serverEnv.betaSessionSecret): boolean {
  if (!token || !secret) return false;
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [body, sig] = parts;
  const expected = sign(body, secret);
  // Constant-time signature check.
  try {
    const ok = crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
    if (!ok) return false;
  } catch {
    return false;
  }
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as { exp?: number };
    return typeof payload.exp === "number" && payload.exp > Date.now();
  } catch {
    return false;
  }
}

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  secure: process.env.NODE_ENV === "production",
  maxAge: Math.floor(SESSION_TTL_MS / 1000),
};

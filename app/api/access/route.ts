import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { serverEnv } from "@/lib/env";
import {
  SESSION_COOKIE,
  SESSION_COOKIE_OPTIONS,
  createSessionToken,
  verifyAccessCode,
} from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({ code: z.string().min(1).max(200) });

export async function POST(req: NextRequest) {
  if (!serverEnv.betaGateEnabled) {
    return NextResponse.json({ ok: true, message: "The access gate is disabled." });
  }
  let body: { code: string };
  try {
    body = schema.parse(await req.json());
  } catch {
    return NextResponse.json({ ok: false, error: "Enter your access code." }, { status: 400 });
  }

  if (!verifyAccessCode(body.code)) {
    // Uniform response timing is provided by the timing-safe compare in verifyAccessCode.
    return NextResponse.json({ ok: false, error: "That access code wasn't recognized." }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, createSessionToken(), SESSION_COOKIE_OPTIONS);
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { ...SESSION_COOKIE_OPTIONS, maxAge: 0 });
  return res;
}

import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { serverEnv } from "@/lib/env";
import { getRecentCalls, getSummary } from "@/lib/ai/instrumentation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Owner-only model-call diagnostics. Disabled unless DIAGNOSTICS_TOKEN is set; requires a
 * matching token (timing-safe). Already behind the beta gate via middleware. Never exposes
 * prompts or content — only task type, model, counts, outcome, and approximate tokens.
 */
function tokenOk(provided: string): boolean {
  const expected = serverEnv.diagnosticsToken;
  if (!expected) return false;
  const a = crypto.createHash("sha256").update(provided).digest();
  const b = crypto.createHash("sha256").update(expected).digest();
  return crypto.timingSafeEqual(a, b) && provided.length === expected.length;
}

export async function GET(req: NextRequest) {
  if (!serverEnv.diagnosticsToken) {
    return NextResponse.json({ error: "Diagnostics are disabled." }, { status: 404, headers: { "cache-control": "no-store" } });
  }
  const token = req.headers.get("x-diagnostics-token") || req.nextUrl.searchParams.get("token") || "";
  if (!tokenOk(token)) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401, headers: { "cache-control": "no-store" } });
  }
  return NextResponse.json(
    { demo: serverEnv.openRouterKey ? false : true, summary: getSummary(), recent: getRecentCalls() },
    { headers: { "cache-control": "no-store" } }
  );
}

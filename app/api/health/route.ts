import { NextResponse } from "next/server";
import { isDemoMode, serverEnv, validateServerEnv } from "@/lib/env";
import { getSearchAdapter } from "@/lib/research/search-adapter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Non-secret status for the Settings page. Never exposes keys. */
export async function GET() {
  const env = validateServerEnv();
  return NextResponse.json(
    {
      demo: isDemoMode(),
      gateEnabled: serverEnv.betaGateEnabled,
      dailyBudget: serverEnv.freeDailyTaskBudget,
      searchProvider: serverEnv.searchProvider,
      // The actual search engine in effect (e.g. "wikipedia", "brave", "none").
      search: getSearchAdapter().name,
      envOk: env.ok,
      warnings: env.warnings,
    },
    { headers: { "cache-control": "no-store" } }
  );
}

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
      // Which optional free providers (separate rate-limit pools) are configured. Each adds a
      // task-suited model to the routing chain; Harbor still runs on OpenRouter alone.
      providers: {
        openrouter: serverEnv.openRouterKey.length > 0,
        mistral: serverEnv.mistralKey.length > 0,
        groq: serverEnv.groqKey.length > 0,
        cerebras: serverEnv.cerebrasKey.length > 0,
        google: serverEnv.geminiKey.length > 0,
      },
      envOk: env.ok,
      warnings: env.warnings,
    },
    { headers: { "cache-control": "no-store" } }
  );
}

/**
 * Server-side environment access + validation.
 *
 * Never import this from a client component. Public values live under NEXT_PUBLIC_*.
 */

function num(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function bool(value: string | undefined, fallback: boolean): boolean {
  if (value == null) return fallback;
  return value === "true" || value === "1";
}

export const serverEnv = {
  openRouterKey: process.env.OPENROUTER_API_KEY?.trim() || "",
  // Optional extra free providers (separate rate-limit pools). All have free tiers at $0.
  // Harbor routes each task to the best-suited available model and falls through the rest.
  mistralKey: process.env.MISTRAL_API_KEY?.trim() || "",
  groqKey: process.env.GROQ_API_KEY?.trim() || "", // very fast (LPU) — great for autocomplete
  cerebrasKey: process.env.CEREBRAS_API_KEY?.trim() || "", // fastest inference
  geminiKey: process.env.GEMINI_API_KEY?.trim() || "", // Gemini 2.5 Flash — strong, 1M context (free tier)
  betaAccessCode: process.env.BETA_ACCESS_CODE?.trim() || "",
  betaSessionSecret: process.env.BETA_SESSION_SECRET?.trim() || "",
  betaGateEnabled: bool(process.env.BETA_GATE_ENABLED, true),
  freeDailyTaskBudget: num(process.env.FREE_DAILY_TASK_BUDGET, 15),
  maxFileSizeMb: num(process.env.MAX_FILE_SIZE_MB, 10),
  maxAttachmentsPerTask: num(process.env.MAX_ATTACHMENTS_PER_TASK, 6),
  maxUrlPages: num(process.env.MAX_URL_PAGES, 12),
  // Web search for research-capable services. "auto" (default) uses Brave when a key is set,
  // otherwise Wikipedia (key-less). "none" disables web search; "duckduckgo" forces DDG (often
  // blocked from servers). See lib/research/search-adapter.ts.
  searchProvider: process.env.SEARCH_PROVIDER?.trim() || "auto",
  // Optional free Brave Search API key for full-web results.
  braveSearchKey: process.env.BRAVE_SEARCH_API_KEY?.trim() || "",
  // Optional self-hosted/owned SearXNG instance → UNLIMITED, $0, full-web search.
  searxngUrl: process.env.SEARXNG_URL?.trim() || "",
  // Owner-only diagnostics. When empty, /diagnostics is disabled entirely.
  diagnosticsToken: process.env.DIAGNOSTICS_TOKEN?.trim() || "",
  // Demo mode is on when explicitly requested OR when no key is configured.
  forceDemo: bool(process.env.NEXT_PUBLIC_DEMO_MODE, false),
} as const;

/** True when at least one model provider key is configured. */
export function anyProviderConfigured(): boolean {
  return Boolean(
    serverEnv.openRouterKey || serverEnv.groqKey || serverEnv.cerebrasKey || serverEnv.geminiKey || serverEnv.mistralKey
  );
}

/** True when Harbor should run without calling external models (no key on ANY provider). */
export function isDemoMode(): boolean {
  return serverEnv.forceDemo || !anyProviderConfigured();
}

/**
 * Validate the environment. Returns problems rather than throwing so the app can
 * surface a clear message instead of a stack trace. In production a weak session
 * secret or a missing access code (when the gate is on) are hard errors.
 */
export function validateServerEnv(): { ok: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const isProd = process.env.NODE_ENV === "production";

  if (serverEnv.betaGateEnabled) {
    if (!serverEnv.betaAccessCode) {
      errors.push("BETA_ACCESS_CODE is required when BETA_GATE_ENABLED=true.");
    }
    if (!serverEnv.betaSessionSecret) {
      errors.push("BETA_SESSION_SECRET is required when BETA_GATE_ENABLED=true.");
    } else if (serverEnv.betaSessionSecret.length < 32) {
      const msg = "BETA_SESSION_SECRET should be at least 32 characters.";
      if (isProd) errors.push(msg);
      else warnings.push(msg);
    } else if (/change-me|dev-only|insecure/i.test(serverEnv.betaSessionSecret) && isProd) {
      errors.push("BETA_SESSION_SECRET still uses the example value. Set a strong secret in production.");
    }
  }

  if (!anyProviderConfigured() && !serverEnv.forceDemo) {
    warnings.push("No model provider key is set (OpenRouter/Groq/Cerebras/Gemini/Mistral) — Harbor is running in demo mode.");
  } else if (!serverEnv.openRouterKey && anyProviderConfigured()) {
    warnings.push("OPENROUTER_API_KEY is not set — running on the other provider(s) only; model capability detection (JSON mode) falls back to the safe default.");
  }

  return { ok: errors.length === 0, errors, warnings };
}

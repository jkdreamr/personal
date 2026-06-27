import type { ModelPreference } from "@/lib/services";
import { modelEnabled } from "./providers";

/**
 * Model routing. Owl Alpha is Harbor's default for nearly all meaningful work.
 * No paid models, no openrouter/auto, no automatic multi-model calls.
 *
 * - primary (owl-alpha): the default for every substantive task — writing, research synthesis,
 *   notes, presentations, proposals, briefs, meeting prep, decisions, challenge, explanation.
 * - fast (gpt-oss): only trivial work — short rewrite, title, formatting cleanup, simple classify.
 * - reviewer (nemotron): only an EXPLICIT, user-requested second opinion / adversarial review.
 * - restricted (laguna): disabled by default; never used for user content unless explicitly enabled.
 */
export const MODELS = {
  primary: "openrouter/owl-alpha",
  fast: "openai/gpt-oss-120b:free",
  reviewer: "nvidia/nemotron-3-ultra-550b-a55b:free",
  restricted: "poolside/laguna-m.1:free",
  // Optional cross-provider last-resort fallback (Mistral, different rate-limit pool). Free on
  // Mistral's "Experiment" tier — only used when MISTRAL_API_KEY is set and all OpenRouter free
  // models have failed. Keep your Mistral account on the free tier to stay at $0.
  mistral: "mistral-small-latest",
} as const;

export type ModelId = (typeof MODELS)[keyof typeof MODELS];

/**
 * Extra free providers (separate rate-limit pools), tagged `provider::model`. All have $0 free
 * tiers. Only used when their key is configured; Harbor routes each task kind to the best fit.
 * - Groq / Cerebras: extremely fast inference (great for autocomplete + short tasks).
 * - Google Gemini 2.5 Flash: strong with a very large (1M-token) context window (great for long
 *   research/briefs). On Google AI Studio's free tier. (2.0 Flash was shut down 2026-06-01.)
 */
export const EXTRA_MODELS = {
  groq70b: "groq::llama-3.3-70b-versatile",
  groq8b: "groq::llama-3.1-8b-instant",
  cerebras70b: "cerebras::llama-3.3-70b",
  cerebras8b: "cerebras::llama3.1-8b",
  gemini: "google::gemini-2.5-flash",
} as const;

/**
 * Hard money safeguard. Harbor must NEVER incur per-token cost. Only the exact models below may be
 * called — OpenRouter free models (owl-alpha + `:free`), Mistral's free Experiment tier, and the
 * Groq/Cerebras/Google free tiers. A `:free` suffix is also accepted defensively. Anything else is refused.
 */
const FREE_ALLOWLIST: ReadonlySet<string> = new Set<string>([...Object.values(MODELS), ...Object.values(EXTRA_MODELS)]);

export function isFreeModel(id: string): boolean {
  return FREE_ALLOWLIST.has(id) || id.endsWith(":free");
}

export function assertFreeModel(id: string): void {
  if (!isFreeModel(id)) {
    throw new Error(`Refusing to call non-free model "${id}". Harbor only uses zero-cost models.`);
  }
}

export type TaskKind =
  | "synthesis" // full service generation — always Owl
  | "rewrite" // short refinement
  | "classify"
  | "title"
  | "autocomplete"
  | "second_opinion"; // explicit adversarial review — Nemotron

/**
 * The universal safety net: every model we have, ordered best-general-quality first, the tiny 8B
 * models last. Appended (filtered to configured providers) to every "quality" task chain so that as
 * long as ANY provider is reachable, the task returns a real result instead of erroring.
 */
const SAFETY_NET: readonly string[] = [
  MODELS.primary,
  EXTRA_MODELS.gemini,
  EXTRA_MODELS.groq70b,
  EXTRA_MODELS.cerebras70b,
  MODELS.reviewer,
  MODELS.fast,
  MODELS.mistral,
  EXTRA_MODELS.groq8b,
  EXTRA_MODELS.cerebras8b,
];

/**
 * Synthesis lead is chosen by the service's declared strength (services.ts `model`), then backed by
 * the rest for resilience — this is how we route "each model to its strength":
 * - "primary" (Owl): the best generalist writer/synthesiser — the default for most services. Gemini
 *   (1M context) is the first fallback so long, source-heavy work (Research/Brief/Meeting/Compare/
 *   Verify) keeps all of its context.
 * - "reviewer" (Nemotron 550B): reasoning / adversarial. Challenge leads here to play to its strength,
 *   with Owl right behind.
 * - "fast": light structuring (Notes) — the fastest *capable* models (Groq/Cerebras 70B) lead for low
 *   latency, with Owl as the quality backstop.
 */
const SYNTHESIS_BY_PREF: Record<ModelPreference, readonly string[]> = {
  primary: [MODELS.primary, EXTRA_MODELS.gemini, EXTRA_MODELS.groq70b, EXTRA_MODELS.cerebras70b, MODELS.fast, MODELS.reviewer, MODELS.mistral],
  reviewer: [MODELS.reviewer, MODELS.primary, EXTRA_MODELS.gemini, EXTRA_MODELS.groq70b, EXTRA_MODELS.cerebras70b, MODELS.fast, MODELS.mistral],
  fast: [EXTRA_MODELS.groq70b, EXTRA_MODELS.cerebras70b, MODELS.fast, MODELS.primary, EXTRA_MODELS.gemini, MODELS.mistral],
};

/**
 * Non-synthesis candidate lists (best fit first), spanning providers:
 * - autocomplete / title / classify: latency dominates → Cerebras/Groq (fastest) lead. Best-effort,
 *   so these stay lean (no heavy tail — a missed suggestion is silent, never a surfaced error).
 * - rewrite (Continue / Improve): quick but quality matters → fast 70Bs, then Gemini.
 * - second_opinion: a strong, *different* model for an independent take → Nemotron, Gemini, 70B.
 */
const CANDIDATES: Record<Exclude<TaskKind, "synthesis">, readonly string[]> = {
  autocomplete: [EXTRA_MODELS.cerebras8b, EXTRA_MODELS.groq8b, EXTRA_MODELS.groq70b, MODELS.fast, MODELS.primary],
  title: [EXTRA_MODELS.groq8b, EXTRA_MODELS.cerebras8b, MODELS.fast, MODELS.primary],
  classify: [EXTRA_MODELS.groq8b, EXTRA_MODELS.cerebras8b, MODELS.fast, MODELS.primary],
  rewrite: [EXTRA_MODELS.groq70b, EXTRA_MODELS.cerebras70b, EXTRA_MODELS.gemini, MODELS.fast, MODELS.primary],
  second_opinion: [MODELS.reviewer, EXTRA_MODELS.gemini, EXTRA_MODELS.groq70b, MODELS.primary, MODELS.fast],
};

/** Kinds where a slow, lower-quality answer beats an error → append the full safety net. */
const EXHAUSTIVE: ReadonlySet<TaskKind> = new Set<TaskKind>(["synthesis", "rewrite", "second_opinion"]);

/**
 * The ordered list of models to try for a task, limited to configured providers and tried until one
 * succeeds. For synthesis, `preference` (the service's declared strength) selects the lead. Quality
 * kinds get the exhaustive safety-net tail so they never error while any provider is up; lean,
 * best-effort kinds keep just a guaranteed OpenRouter fallback.
 */
export function chainFor(kind: TaskKind, preference: ModelPreference = "primary"): string[] {
  const base = kind === "synthesis" ? SYNTHESIS_BY_PREF[preference] : CANDIDATES[kind];
  let chain = base.filter((m) => modelEnabled(m));
  if (EXHAUSTIVE.has(kind)) {
    chain = chain.concat(SAFETY_NET.filter((m) => modelEnabled(m)));
  } else {
    if (modelEnabled(MODELS.fast)) chain.push(MODELS.fast);
    if (modelEnabled(MODELS.primary)) chain.push(MODELS.primary);
  }
  return Array.from(new Set(chain));
}

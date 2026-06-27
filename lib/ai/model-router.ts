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
 * - Google Gemini 2.0 Flash: strong with a very large context window (great for long research/briefs).
 */
export const EXTRA_MODELS = {
  groq70b: "groq::llama-3.3-70b-versatile",
  groq8b: "groq::llama-3.1-8b-instant",
  cerebras70b: "cerebras::llama-3.3-70b",
  cerebras8b: "cerebras::llama3.1-8b",
  gemini: "google::gemini-2.0-flash",
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

/** Resolve the model id for a task. Synthesis is always Owl; trivial kinds use the fast model. */
export function routeModel(_preference: ModelPreference, kind: TaskKind): ModelId {
  switch (kind) {
    case "second_opinion":
      return MODELS.reviewer;
    case "autocomplete":
    case "title":
    case "classify":
    case "rewrite":
      return MODELS.fast;
    case "synthesis":
    default:
      // Owl Alpha by default for every meaningful task, regardless of service.
      return MODELS.primary;
  }
}

/**
 * Resilience fallback — tried IN ORDER only when a model fails, never to call several models
 * on success. Owl Alpha is an alpha model and can be flaky/unavailable, so the chain degrades
 * Owl → GPT-OSS → Nemotron (all free) to keep a real result coming back. Laguna is never used.
 */
export function fallbackChain(preferred: ModelId): ModelId[] {
  if (preferred === MODELS.reviewer) {
    // An explicit second opinion degrades to Owl, then GPT-OSS.
    return Array.from(new Set<ModelId>([MODELS.reviewer, MODELS.primary, MODELS.fast]));
  }
  return Array.from(new Set<ModelId>([preferred, MODELS.primary, MODELS.fast, MODELS.reviewer]));
}

/**
 * Task-aware routing. Each kind has an ordered candidate list (best fit first) spanning providers;
 * the chain is filtered to whichever providers are configured and tried in order until one works.
 * Reasoning behind the ordering:
 * - autocomplete / title / classify: latency dominates → Cerebras/Groq (fastest) first.
 * - rewrite: quick but quality matters a little → fast 70Bs, then Gemini, then OpenRouter free.
 * - synthesis: quality first → Owl (default), then Gemini Flash (strong + huge context for long docs),
 *   then a fast 70B, then the always-free OpenRouter models, then Mistral.
 * - second_opinion: a strong, *different* model for an independent take → Nemotron, Gemini, 70B.
 */
const CANDIDATES: Record<TaskKind, string[]> = {
  autocomplete: [EXTRA_MODELS.cerebras8b, EXTRA_MODELS.groq8b, EXTRA_MODELS.groq70b, MODELS.fast, MODELS.primary],
  title: [EXTRA_MODELS.groq8b, EXTRA_MODELS.cerebras8b, MODELS.fast, MODELS.primary],
  classify: [EXTRA_MODELS.groq8b, EXTRA_MODELS.cerebras8b, MODELS.fast, MODELS.primary],
  rewrite: [EXTRA_MODELS.groq70b, EXTRA_MODELS.cerebras70b, EXTRA_MODELS.gemini, MODELS.fast, MODELS.primary],
  synthesis: [MODELS.primary, EXTRA_MODELS.gemini, EXTRA_MODELS.groq70b, EXTRA_MODELS.cerebras70b, MODELS.fast, MODELS.reviewer, MODELS.mistral],
  second_opinion: [MODELS.reviewer, EXTRA_MODELS.gemini, EXTRA_MODELS.groq70b, MODELS.primary, MODELS.fast],
};

/** The ordered list of models to try for a task kind, limited to configured providers. */
export function chainFor(kind: TaskKind): string[] {
  const chain = CANDIDATES[kind].filter((m) => modelEnabled(m));
  // Guarantee a usable OpenRouter free model is present when its key is set.
  if (modelEnabled(MODELS.fast) && !chain.includes(MODELS.fast)) chain.push(MODELS.fast);
  return Array.from(new Set(chain));
}

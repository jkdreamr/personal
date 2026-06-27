import type { ModelPreference } from "@/lib/services";

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
 * Hard money safeguard. Harbor must NEVER incur per-token cost. Only the exact models in MODELS
 * may be called: owl-alpha is a free OpenRouter stealth model; the `:free` variants are zero-priced;
 * `mistral-small-latest` is free on Mistral's Experiment tier (opt-in via MISTRAL_API_KEY). A
 * `:free` suffix is also accepted defensively. Anything else is refused.
 */
const FREE_ALLOWLIST: ReadonlySet<string> = new Set<string>(Object.values(MODELS));

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

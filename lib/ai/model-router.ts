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
} as const;

export type ModelId = (typeof MODELS)[keyof typeof MODELS];

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
 * Resilience fallback only — used when the preferred model is unavailable, NOT to call several
 * models per task by default. Limited to Owl → GPT-OSS. Nemotron and Laguna are never auto-used.
 */
export function fallbackChain(preferred: ModelId): ModelId[] {
  if (preferred === MODELS.reviewer) {
    // An explicit second opinion falls back only to Owl, never down to the fast model.
    return [MODELS.reviewer, MODELS.primary];
  }
  return Array.from(new Set<ModelId>([preferred, MODELS.primary, MODELS.fast]));
}

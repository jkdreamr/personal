import type { ModelPreference } from "@/lib/services";

/**
 * Model routing. Only these IDs are used. No paid models, no openrouter/auto.
 *
 * - fast (gpt-oss): short rewrites, formatting, classification, extraction cleanup,
 *   autocomplete, lightweight summaries, titles.
 * - primary (owl-alpha): multi-source synthesis, research, briefings, complex writing,
 *   presentations, proposals, decisions, long context.
 * - reviewer (nemotron): challenge mode, second opinion, adversarial critique.
 */
export const MODELS = {
  primary: "openrouter/owl-alpha",
  reviewer: "nvidia/nemotron-3-ultra-550b-a55b:free",
  fast: "openai/gpt-oss-120b:free",
} as const;

export type ModelId = (typeof MODELS)[ModelPreference];

export type TaskKind =
  | "synthesis" // full service generation
  | "rewrite" // short refinement
  | "classify"
  | "title"
  | "autocomplete";

/** Resolve the model id for a given service preference and task kind. */
export function routeModel(preference: ModelPreference, kind: TaskKind): ModelId {
  // Lightweight kinds always use the fast model regardless of the service preference.
  if (kind === "autocomplete" || kind === "title" || kind === "classify") {
    return MODELS.fast;
  }
  if (kind === "rewrite") {
    // Short rewrites use the fast model unless the service is the adversarial reviewer.
    return preference === "reviewer" ? MODELS.reviewer : MODELS.fast;
  }
  // Full synthesis honors the service preference.
  return MODELS[preference];
}

/** The approved free fallback order when the preferred model is unavailable. */
export function fallbackChain(preferred: ModelId): ModelId[] {
  const free: ModelId[] = [MODELS.fast, MODELS.reviewer];
  // Try the preferred model, then approved free models, de-duplicated.
  return Array.from(new Set<ModelId>([preferred, ...free]));
}

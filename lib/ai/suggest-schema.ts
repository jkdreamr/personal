import { z } from "zod";

/**
 * Structured contract for editorial suggestions (the "Suggest" feature). Each suggestion targets an
 * EXACT quote from the draft so it can be mapped to a document range, accepted as a precise patch,
 * and detected as stale when the text changes.
 */
export const SUGGESTION_CATEGORIES = [
  "clarity",
  "grammar",
  "concision",
  "tone",
  "repetition",
  "structure",
  "specificity",
  "consistency",
] as const;

export type SuggestionCategory = (typeof SUGGESTION_CATEGORIES)[number];

export const suggestionSchema = z.object({
  /** An exact substring of the draft to improve. */
  target: z.string().min(1).max(400),
  /** The proposed replacement for `target` ("" means delete it). */
  replacement: z.string().max(800),
  category: z.enum(SUGGESTION_CATEGORIES),
  /** One concise sentence on why. */
  rationale: z.string().min(1).max(300),
});

export const suggestResponseSchema = z.object({
  suggestions: z.array(suggestionSchema).max(8).default([]),
  /** Broader, document-level recommendations grounded in the goal + draft. */
  overall: z.array(z.string().min(1).max(300)).max(6).default([]),
});

export type Suggestion = z.infer<typeof suggestionSchema>;
export type SuggestResponse = z.infer<typeof suggestResponseSchema>;

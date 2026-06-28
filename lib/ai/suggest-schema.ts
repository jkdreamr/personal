import { z } from "zod";

/**
 * Structured contract for editorial suggestions (the "Suggest" feature). Each suggestion targets an
 * EXACT quote from the draft so it can be mapped to a document range, accepted as a precise patch,
 * and detected as stale when the text changes.
 */
export const SUGGESTION_CATEGORIES = [
  "clarity",
  "concision",
  "expand",
  "grammar",
  "punctuation",
  "word-choice",
  "tone",
  "style",
  "flow",
  "repetition",
  "structure",
  "specificity",
  "consistency",
  "addition",
] as const;

export type SuggestionCategory = (typeof SUGGESTION_CATEGORIES)[number];

/**
 * Presentation metadata so the UI can explain ITSELF: a friendly label per category, and a small set
 * of human "kinds" the panel groups by, so a reader sees the RANGE of what Suggest does at a glance.
 */
export type SuggestionGroup = "grammar" | "clarity" | "wording" | "length" | "flow" | "ideas";

export const CATEGORY_LABEL: Record<SuggestionCategory, string> = {
  clarity: "Clarity",
  concision: "Tighten",
  expand: "Expand",
  grammar: "Grammar",
  punctuation: "Punctuation",
  "word-choice": "Word choice",
  tone: "Tone",
  style: "Style",
  flow: "Flow",
  repetition: "Repetition",
  structure: "Structure",
  specificity: "Be specific",
  consistency: "Consistency",
  addition: "Add a sentence",
};

const CATEGORY_GROUP: Record<SuggestionCategory, SuggestionGroup> = {
  grammar: "grammar",
  punctuation: "grammar",
  clarity: "clarity",
  specificity: "clarity",
  consistency: "clarity",
  "word-choice": "wording",
  tone: "wording",
  style: "wording",
  concision: "length",
  expand: "length",
  flow: "flow",
  repetition: "flow",
  structure: "flow",
  addition: "ideas",
};

/** Human label + display order for the groups. */
export const GROUP_ORDER: SuggestionGroup[] = ["grammar", "clarity", "wording", "length", "flow", "ideas"];
export const GROUP_LABEL: Record<SuggestionGroup, string> = {
  grammar: "Grammar & punctuation",
  clarity: "Clarity",
  wording: "Wording",
  length: "Length",
  flow: "Flow & structure",
  ideas: "Ideas to add",
};

export function groupForCategory(category: string): SuggestionGroup {
  return CATEGORY_GROUP[category as SuggestionCategory] ?? "wording";
}

export function categoryLabel(category: string): string {
  return CATEGORY_LABEL[category as SuggestionCategory] ?? category;
}

export const suggestionSchema = z.object({
  /** An exact substring of the draft to improve. */
  target: z.string().min(1).max(400),
  /** The proposed replacement for `target` ("" means delete it). */
  replacement: z.string().max(800),
  category: z.enum(SUGGESTION_CATEGORIES),
  /** One concise sentence on why. */
  rationale: z.string().min(1).max(300),
  /**
   * Exact text immediately BEFORE/AFTER `target` in the draft. Used to anchor the correct occurrence
   * when `target` is a repeated phrase, so the edit never lands on the wrong instance. Optional —
   * resolution falls back to a unique match, and drops the suggestion if it stays ambiguous.
   */
  before: z.string().max(120).optional(),
  after: z.string().max(120).optional(),
});

export const suggestResponseSchema = z.object({
  suggestions: z.array(suggestionSchema).max(16).default([]),
  /** Broader, document-level recommendations grounded in the goal + draft. */
  overall: z.array(z.string().min(1).max(300)).max(8).default([]),
});

export type Suggestion = z.infer<typeof suggestionSchema>;
export type SuggestResponse = z.infer<typeof suggestResponseSchema>;

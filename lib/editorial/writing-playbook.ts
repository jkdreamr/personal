/**
 * Harbor's writing playbook. This is NOT an "AI-detector evasion" tool. It is a
 * voice-preserving editorial standard that makes writing clearer, more specific, and less
 * generic. The rules guide generation; the flagged phrases drive non-destructive warnings.
 */

export const WRITING_RULES = [
  "Start with the user's actual viewpoint, notes, evidence, and intended action.",
  "Use concrete facts, names, dates, decisions, and specifics from the context.",
  "Preserve uncertainty; do not overstate.",
  "Prefer direct sentences and active verbs.",
  "Avoid generic opening paragraphs and fake enthusiasm.",
  "Avoid inflated corporate jargon.",
  "Avoid forced symmetry ('three perfect points') unless it aids clarity.",
  "Avoid vague conclusions and generic summaries.",
  "Avoid excessive em dashes, too many headings in short writing, and generic transitions.",
  "Never fabricate anecdotes, quotes, or unsupported claims.",
  "Do not add fake imperfections, slang, typos, or quirks.",
] as const;

/** Phrases flagged as editorial WARNINGS (never auto-removed). */
export const FLAGGED_PHRASES: string[] = [
  "in today's rapidly evolving landscape",
  "in today's fast-paced world",
  "it is important to note",
  "delve into",
  "leverage",
  "robust",
  "holistic",
  "underscores the importance",
  "game-changing",
  "unlock",
  "seamlessly",
  "at the end of the day",
  "in conclusion",
  "needless to say",
  "this highlights the importance of",
  "navigating the complexities",
  "in the realm of",
  "a testament to",
  "ever-changing",
  "cutting-edge",
];

export type EditorialDimension =
  | "specificity"
  | "clarity"
  | "repetition"
  | "tone"
  | "unsupported"
  | "generic"
  | "cliche"
  | "over-polished"
  | "weak-pov"
  | "ending";

export const EDITORIAL_DIMENSIONS: { id: EditorialDimension; label: string }[] = [
  { id: "specificity", label: "Specificity" },
  { id: "clarity", label: "Clarity" },
  { id: "repetition", label: "Repetition" },
  { id: "tone", label: "Tone fit" },
  { id: "unsupported", label: "Unsupported claims" },
  { id: "generic", label: "Generic phrasing" },
  { id: "cliche", label: "Clichés" },
  { id: "over-polished", label: "Over-polished language" },
  { id: "weak-pov", label: "Weak point of view" },
  { id: "ending", label: "Useful ending action" },
];

import { FLAGGED_PHRASES } from "./writing-playbook";

export type StyleWarning = {
  kind: "cliche" | "em-dash" | "long-sentence" | "hedging" | "exclamation";
  message: string;
  /** The offending snippet, for highlighting. */
  match: string;
};

const HEDGES = ["i think", "kind of", "sort of", "perhaps maybe", "it could be argued"];

/**
 * Scan text and return non-destructive editorial warnings. These are SUGGESTIONS shown to
 * the user — Harbor never silently rewrites their draft.
 */
export function lintText(text: string): StyleWarning[] {
  const warnings: StyleWarning[] = [];
  if (!text) return warnings;
  const lower = text.toLowerCase();

  for (const phrase of FLAGGED_PHRASES) {
    let idx = lower.indexOf(phrase);
    while (idx !== -1) {
      warnings.push({
        kind: "cliche",
        message: `"${text.slice(idx, idx + phrase.length)}" is generic — try something concrete from your material.`,
        match: text.slice(idx, idx + phrase.length),
      });
      idx = lower.indexOf(phrase, idx + phrase.length);
      // Only flag the first occurrence of each phrase to avoid noise.
      break;
    }
  }

  // Excessive em dashes.
  const emDashes = (text.match(/—/g) ?? []).length;
  const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
  if (emDashes >= 3 && emDashes > sentences.length / 3) {
    warnings.push({ kind: "em-dash", message: "Several em dashes — consider periods or commas for a calmer rhythm.", match: "—" });
  }

  // Very long sentences.
  for (const s of sentences) {
    const words = s.trim().split(/\s+/).length;
    if (words > 42) {
      warnings.push({ kind: "long-sentence", message: "This sentence runs long; splitting it would read clearer.", match: s.slice(0, 60) + "…" });
      break;
    }
  }

  for (const h of HEDGES) {
    if (lower.includes(h)) {
      warnings.push({ kind: "hedging", message: `"${h}" softens your point — state it directly if you mean it.`, match: h });
      break;
    }
  }

  const bangs = (text.match(/!/g) ?? []).length;
  if (bangs >= 3) {
    warnings.push({ kind: "exclamation", message: "Several exclamation marks read as forced enthusiasm.", match: "!" });
  }

  return warnings;
}

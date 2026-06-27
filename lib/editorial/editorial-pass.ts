import { lintText, type StyleWarning } from "./style-lint";
import { EDITORIAL_DIMENSIONS, type EditorialDimension } from "./writing-playbook";

export type EditorialSuggestion = {
  dimension: EditorialDimension;
  label: string;
  note: string;
  /** Optional snippet this refers to. */
  snippet?: string;
};

/**
 * A local Editorial Pass: produces editable suggestions across the playbook dimensions.
 * Never rewrites the draft. Pairs with the style linter for concrete cliché/structure hits.
 */
export function editorialPass(text: string): { warnings: StyleWarning[]; suggestions: EditorialSuggestion[] } {
  const warnings = lintText(text);
  const suggestions: EditorialSuggestion[] = [];
  const trimmed = text.trim();
  const wordCount = trimmed ? trimmed.split(/\s+/).length : 0;
  const sentences = trimmed.split(/(?<=[.!?])\s+/).filter(Boolean);
  const headings = (text.match(/^#{1,3}\s|\n[A-Z][^\n]{0,40}:\s*$/gm) ?? []).length;

  const has = (id: EditorialDimension) => suggestions.some((s) => s.dimension === id);
  const label = (id: EditorialDimension) => EDITORIAL_DIMENSIONS.find((d) => d.id === id)?.label ?? id;

  // Cliché / generic phrasing
  if (warnings.some((w) => w.kind === "cliche")) {
    suggestions.push({ dimension: "cliche", label: label("cliche"), note: "A few stock phrases crept in. Replace them with specifics from your material." });
  }

  // Specificity: low ratio of numbers/proper nouns
  const specifics = (text.match(/\b\d[\d,.%$]*\b|\b[A-Z][a-z]+(?:\s[A-Z][a-z]+)?\b/g) ?? []).length;
  if (wordCount > 60 && specifics / Math.max(1, wordCount) < 0.04) {
    suggestions.push({ dimension: "specificity", label: label("specificity"), note: "This reads a little abstract. Naming people, dates, or numbers would make it land." });
  }

  // Over-structure for short writing
  if (wordCount < 150 && headings >= 3) {
    suggestions.push({ dimension: "generic", label: label("generic"), note: "Short writing rarely needs this many headings — a couple of tight paragraphs may read better." });
  }

  // Clarity: long sentences
  if (warnings.some((w) => w.kind === "long-sentence")) {
    suggestions.push({ dimension: "clarity", label: label("clarity"), note: "One or more sentences run long. Splitting them improves clarity." });
  }

  // Weak point of view: hedging
  if (warnings.some((w) => w.kind === "hedging")) {
    suggestions.push({ dimension: "weak-pov", label: label("weak-pov"), note: "Some hedging language softens your stance. If you mean it, say it directly." });
  }

  // Repetition: repeated opening words
  const openers = sentences.map((s) => s.trim().split(/\s+/)[0]?.toLowerCase()).filter(Boolean);
  const counts = openers.reduce<Record<string, number>>((m, w) => ((m[w!] = (m[w!] ?? 0) + 1), m), {});
  if (Object.values(counts).some((n) => n >= 3)) {
    suggestions.push({ dimension: "repetition", label: label("repetition"), note: "Several sentences start the same way. Varying the openings reads more naturally." });
  }

  // Ending action
  if (wordCount > 80 && !/\b(next step|please|let me know|i'll|we'll|by\s+\w+day|action|recommend)\b/i.test(text.slice(-280))) {
    suggestions.push({ dimension: "ending", label: label("ending"), note: "Consider ending with a clear next step so the reader knows what to do." });
  }

  // Over-polished: exclamation overuse
  if (warnings.some((w) => w.kind === "exclamation") && !has("tone")) {
    suggestions.push({ dimension: "tone", label: label("tone"), note: "The enthusiasm reads a touch forced — a calmer tone is usually more credible." });
  }

  return { warnings, suggestions };
}

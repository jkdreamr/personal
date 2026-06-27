/**
 * Suffix-aware safety for ghost autocomplete. When the caret has text AFTER it (a suffix), a
 * completion must lead into that text without colliding with it. This makes a candidate safe to
 * insert before the suffix, or rejects it.
 */
export function fitBeforeSuffix(ghost: string, suffix: string): string | null {
  const g = ghost.trim();
  if (!g) return null;
  const after = suffix.trim();
  if (after) {
    // If the model re-wrote what already follows the cursor, inserting it would duplicate the text.
    // Compare on words only (ignore punctuation/case) so "happy." still matches "happy".
    const norm = (s: string) => s.toLowerCase().replace(/[^\w\s]/g, "");
    const firstWords = norm(after).split(/\s+/).slice(0, 4).join(" ");
    if (firstWords.length >= 4 && norm(g).includes(firstWords)) return null;
  }
  // End cleanly so the inserted text never glues onto the following sentence.
  const closed = /[.!?,:;]$/.test(g) ? g : `${g}.`;
  return `${closed} `;
}

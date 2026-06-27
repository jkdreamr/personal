/**
 * Locate an exact text quote inside a Tiptap document and return its ProseMirror range. Searches
 * within each text block (so a target spanning multiple marks in one paragraph still matches), which
 * is what suggestion targets always are.
 *
 * Repeated wording is the hazard: a bare quote can occur many times, and editing the first match may
 * change the wrong sentence. `findAnchoredRange` disambiguates by the exact text immediately
 * before/after the target, and refuses to guess when a repeated quote stays ambiguous.
 */
import type { Editor } from "@tiptap/react";

export type TextRange = { from: number; to: number };

/** Every occurrence of `query` across the document's text blocks, in document order. */
export function findRanges(editor: Editor, query: string): TextRange[] {
  const q = query.trim();
  if (!q) return [];
  const out: TextRange[] = [];

  editor.state.doc.descendants((node, pos) => {
    if (!node.isTextblock) return true;
    // Build this block's flat text + a per-character absolute-position map.
    let text = "";
    const map: number[] = [];
    node.descendants((child, childPos) => {
      if (child.isText && child.text) {
        for (let i = 0; i < child.text.length; i++) {
          text += child.text[i];
          map.push(pos + 1 + childPos + i); // pos+1 = block content start
        }
      }
      return true;
    });
    let idx = text.indexOf(q);
    while (idx !== -1) {
      out.push({ from: map[idx], to: map[idx + q.length - 1] + 1 });
      idx = text.indexOf(q, idx + 1);
    }
    return true;
  });

  return out;
}

/** First occurrence only — kept for callers that don't need occurrence safety. */
export function findRange(editor: Editor, query: string): TextRange | null {
  return findRanges(editor, query)[0] ?? null;
}

/**
 * Resolve a suggestion's target to the CORRECT occurrence using before/after context anchors.
 * - 0 matches → null.
 * - 1 match → use it.
 * - >1 matches → score each by how well the document text adjacent to it matches `before`/`after`;
 *   use the single best-scoring candidate. If nothing disambiguates (no anchors, or a tie), return
 *   null rather than risk editing the wrong instance.
 */
export function findAnchoredRange(
  editor: Editor,
  target: string,
  anchors?: { before?: string; after?: string }
): TextRange | null {
  const ranges = findRanges(editor, target);
  if (ranges.length <= 1) return ranges[0] ?? null;

  const before = anchors?.before?.trim() ?? "";
  const after = anchors?.after?.trim() ?? "";
  if (!before && !after) return null; // ambiguous with no way to choose → don't guess

  const docSize = editor.state.doc.content.size;
  const score = (r: TextRange): number => {
    let s = 0;
    if (before) {
      const ctx = editor.state.doc.textBetween(Math.max(0, r.from - (before.length + 8)), r.from, "\n", " ");
      if (ctx.endsWith(before)) s += 2;
      else if (ctx.includes(before)) s += 1;
    }
    if (after) {
      const ctx = editor.state.doc.textBetween(r.to, Math.min(docSize, r.to + after.length + 8), "\n", " ");
      if (ctx.startsWith(after)) s += 2;
      else if (ctx.includes(after)) s += 1;
    }
    return s;
  };

  const scored = ranges.map((r) => ({ r, s: score(r) })).sort((a, b) => b.s - a.s);
  if (scored[0].s === 0) return null; // anchors matched nothing → still ambiguous
  if (scored[1] && scored[1].s === scored[0].s) return null; // tie → ambiguous
  return scored[0].r;
}

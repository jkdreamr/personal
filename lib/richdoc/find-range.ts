/**
 * Locate an exact text quote inside a Tiptap document and return its ProseMirror range. Searches
 * within each text block (so a target spanning multiple marks in one paragraph still matches), which
 * is what suggestion targets always are. Returns null when the quote no longer appears (i.e. stale).
 */
import type { Editor } from "@tiptap/react";

export function findRange(editor: Editor, query: string): { from: number; to: number } | null {
  const q = query.trim();
  if (!q) return null;
  let result: { from: number; to: number } | null = null;

  editor.state.doc.descendants((node, pos) => {
    if (result) return false;
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
    const idx = text.indexOf(q);
    if (idx !== -1) {
      result = { from: map[idx], to: map[idx + q.length - 1] + 1 };
      return false;
    }
    return true;
  });

  return result;
}

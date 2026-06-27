/**
 * Harbor's canonical rich-document model.
 *
 * The source of truth for editable prose is a versioned ProseMirror/Tiptap JSON document — NOT
 * HTML and NOT a markdown string. Markdown and plaintext are derived, deterministic *views* used
 * for export, copy, and AI context. Storing structured JSON lets us preserve formatting that
 * markdown can't (underline, checklist state, math) and migrate safely as the schema evolves.
 */

/** Bump when the document schema changes in a way that needs migration. */
export const RICHDOC_VERSION = 1;

export type RichMark = { type: string; attrs?: Record<string, unknown> };

/** A ProseMirror-shaped node (subset we rely on). */
export type RichNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: RichNode[];
  marks?: RichMark[];
  text?: string;
};

/** The canonical stored document: a ProseMirror `doc` plus a schema version stamp. */
export type RichDoc = {
  version: number;
  type: "doc";
  content: RichNode[];
};

/** A minimal, valid empty document (one empty paragraph). */
export function emptyDoc(): RichDoc {
  return { version: RICHDOC_VERSION, type: "doc", content: [{ type: "paragraph" }] };
}

/** Structural guard: a plausibly-valid rich document. */
export function isRichDoc(value: unknown): value is RichDoc {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return v.type === "doc" && Array.isArray(v.content);
}

/** True when a document has no real text content (only empty blocks). */
export function isDocEmpty(doc: { content?: RichNode[] } | null | undefined): boolean {
  if (!doc?.content?.length) return true;
  const hasText = (n: RichNode): boolean => {
    if (n.type === "text" && (n.text ?? "").trim()) return true;
    if (n.type === "inlineMath" || n.type === "blockMath") return Boolean((n.attrs?.latex as string)?.trim());
    if (n.type === "horizontalRule" || n.type === "image") return true;
    return (n.content ?? []).some(hasText);
  };
  return !doc.content.some(hasText);
}

/** Strip the version stamp to get a plain ProseMirror doc the editor can load. */
export function toProseMirrorDoc(doc: RichDoc): { type: "doc"; content: RichNode[] } {
  return { type: "doc", content: doc.content ?? [] };
}

/** Stamp a plain ProseMirror doc (from `editor.getJSON()`) as a canonical RichDoc. */
export function fromProseMirrorDoc(pm: { type?: string; content?: RichNode[] }): RichDoc {
  return { version: RICHDOC_VERSION, type: "doc", content: pm.content ?? [] };
}

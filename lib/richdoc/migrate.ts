/**
 * Migration + resolution helpers. Legacy tasks stored edits as a markdown/plaintext string in
 * `editedBody`. The canonical store is now `doc` (RichDoc JSON). These helpers upgrade legacy edits
 * losslessly and decide which document to show, preserving every existing saved task.
 */
import { markdownToDoc } from "./parse";
import { isRichDoc, type RichDoc } from "./types";

/** Anything task-like that may carry a canonical doc and/or a legacy markdown body. */
export type EditableSource = { doc?: unknown; editedBody?: string };

/** Convert a legacy markdown/plaintext body into a canonical rich document. */
export function legacyBodyToDoc(body: string): RichDoc {
  return markdownToDoc(body ?? "");
}

/**
 * Resolve the canonical document to edit/render for a source, in precedence order:
 *   1. an existing `doc` (canonical) — preferred, lossless
 *   2. a legacy `editedBody` markdown string — migrated on the fly
 *   3. `null` — no user document yet (caller seeds from the artifact)
 */
export function resolveDoc(source: EditableSource | null | undefined): RichDoc | null {
  if (!source) return null;
  if (isRichDoc(source.doc)) return source.doc as RichDoc;
  if (typeof source.editedBody === "string" && source.editedBody.trim()) return legacyBodyToDoc(source.editedBody);
  return null;
}

/** True when a source still needs migration (has a legacy body but no canonical doc). */
export function needsMigration(source: EditableSource | null | undefined): boolean {
  return Boolean(source && !isRichDoc(source.doc) && typeof source.editedBody === "string" && source.editedBody.trim());
}

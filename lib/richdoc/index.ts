/**
 * Harbor rich-document foundation — the canonical, versioned representation of editable prose.
 * Source of truth is ProseMirror/Tiptap JSON (`RichDoc`); markdown and plaintext are deterministic
 * derived views for export, copy, and AI context.
 */
export {
  RICHDOC_VERSION,
  emptyDoc,
  isRichDoc,
  isDocEmpty,
  toProseMirrorDoc,
  fromProseMirrorDoc,
  type RichDoc,
  type RichNode,
  type RichMark,
} from "./types";
export { docToMarkdown, docToText, docWordCount } from "./serialize";
export { markdownToDoc } from "./parse";
export { legacyBodyToDoc, resolveDoc, needsMigration, type EditableSource } from "./migrate";
export { richDocExtensions, RICHDOC_EXTENSIONS, type RichDocExtensionOptions } from "./extensions";

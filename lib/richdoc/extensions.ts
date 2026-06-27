/**
 * The single shared Tiptap extension set used everywhere editable prose appears — the editor, the
 * read-only renderer, and the headless markdown parser. One schema means documents serialize,
 * render, and round-trip identically across every surface (rule: one RichDocumentEditor/Renderer,
 * not per-service editors).
 */
import StarterKit from "@tiptap/starter-kit";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Placeholder from "@tiptap/extension-placeholder";
import { InlineMath, BlockMath } from "@tiptap/extension-mathematics";
import { TextStyle } from "@tiptap/extension-text-style";
import { FontFamily } from "@tiptap/extension-font-family";
import { Markdown } from "tiptap-markdown";
import { nodeInputRule, type Extensions } from "@tiptap/core";
import { ImproveHighlight } from "./improve-highlight";
import { GhostText } from "./ghost-text";
import { SuggestionMarks } from "./suggestion-marks";

// The bundled math input rules are anchored to the start of a block, so `$x$` typed mid-line (or
// even at line start, fragilely) never converts. Replace them with rules that fire anywhere:
// inline `$…$` (opening `$` not preceded by another `$`, so it won't grab the first `$` of `$$`),
// and display `$$…$$`. The KaTeX node view is inherited, so rendering + graceful fallback are kept.
const InlineMathTyped = InlineMath.extend({
  addInputRules() {
    return [
      nodeInputRule({
        find: /(?<!\$)\$([^$\n]+?)\$$/,
        type: this.type,
        getAttributes: (m) => ({ latex: (m[1] ?? "").trim() }),
      }),
    ];
  },
});
const BlockMathTyped = BlockMath.extend({
  addInputRules() {
    return [
      nodeInputRule({
        find: /^\$\$([^$\n]+?)\$\$$/,
        type: this.type,
        getAttributes: (m) => ({ latex: (m[1] ?? "").trim() }),
      }),
    ];
  },
});

export type RichDocExtensionOptions = {
  /** Placeholder text shown in an empty editor. */
  placeholder?: string;
};

export function richDocExtensions(opts: RichDocExtensionOptions = {}): Extensions {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      codeBlock: { HTMLAttributes: { class: "rich-code-block" } },
      // Links: never auto-open inside the editor; force safe rel/target; default protocol allowlist
      // (Tiptap blocks javascript:/data: schemes) protects against injected hrefs.
      link: {
        openOnClick: false,
        autolink: true,
        HTMLAttributes: { rel: "noopener noreferrer nofollow", target: "_blank" },
      },
    }),
    TaskList,
    TaskItem.configure({ nested: true }),
    // Per-text font: a TextStyle mark carrying a font-family, applied to the selection from the
    // toolbar. The canonical JSON preserves it; markdown export (which can't express fonts) ignores it.
    TextStyle,
    FontFamily,
    // Inline `$...$` and display `$$...$$` math via KaTeX. throwOnError:false renders invalid LaTeX
    // inline (in red) instead of crashing the document — graceful degradation, never a hard error.
    InlineMathTyped.configure({ katexOptions: { throwOnError: false } }),
    BlockMathTyped.configure({ katexOptions: { throwOnError: false } }),
    // Markdown paste conversion; html:false blocks raw HTML injection from pasted/loaded content.
    Markdown.configure({ html: false, transformPastedText: true, transformCopiedText: false, breaks: false }),
    Placeholder.configure({ placeholder: opts.placeholder ?? "Start writing…" }),
    ImproveHighlight,
    GhostText,
    SuggestionMarks,
  ];
}

/** Default extension set (no placeholder), suitable for the renderer and headless parsing. */
export const RICHDOC_EXTENSIONS = richDocExtensions();

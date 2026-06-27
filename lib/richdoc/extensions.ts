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
import { Markdown } from "tiptap-markdown";
import type { Extensions } from "@tiptap/core";

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
    // Inline `$...$` and display `$$...$$` math via KaTeX. throwOnError:false renders invalid LaTeX
    // inline (in red) instead of crashing the document — graceful degradation, never a hard error.
    InlineMath.configure({ katexOptions: { throwOnError: false } }),
    BlockMath.configure({ katexOptions: { throwOnError: false } }),
    // Markdown paste conversion; html:false blocks raw HTML injection from pasted/loaded content.
    Markdown.configure({ html: false, transformPastedText: true, transformCopiedText: false, breaks: false }),
    Placeholder.configure({ placeholder: opts.placeholder ?? "Start writing…" }),
  ];
}

/** Default extension set (no placeholder), suitable for the renderer and headless parsing. */
export const RICHDOC_EXTENSIONS = richDocExtensions();

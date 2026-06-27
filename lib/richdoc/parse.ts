/**
 * Markdown → canonical document. Used for migrating legacy plaintext/markdown edits and for
 * markdown-aware paste. Runs a short-lived headless Tiptap editor (needs a DOM — browser at runtime,
 * jsdom in tests), then post-processes `$...$` / `$$...$$` into math nodes.
 */
import { Editor } from "@tiptap/core";
import { RICHDOC_EXTENSIONS } from "./extensions";
import { fromProseMirrorDoc, type RichDoc, type RichNode } from "./types";

function headlessJSON(markdown: string): { type: string; content?: RichNode[] } {
  // A detached element keeps this safe in any DOM-providing environment.
  const element = typeof document !== "undefined" ? document.createElement("div") : undefined;
  const editor = new Editor({ element, extensions: RICHDOC_EXTENSIONS, content: markdown });
  try {
    return editor.getJSON() as { type: string; content?: RichNode[] };
  } finally {
    editor.destroy();
  }
}

// ---- math injection (markdown-it doesn't know LaTeX) -----------------------

const BLOCK_MATH = /^\$\$([\s\S]+?)\$\$$/;
const INLINE_MATH = /\$([^$\n]+?)\$/g;

function splitInlineMath(text: string): RichNode[] {
  const out: RichNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  INLINE_MATH.lastIndex = 0;
  while ((m = INLINE_MATH.exec(text))) {
    if (m.index > last) out.push({ type: "text", text: text.slice(last, m.index) });
    out.push({ type: "inlineMath", attrs: { latex: m[1] } });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ type: "text", text: text.slice(last) });
  return out;
}

function injectMath(node: RichNode): RichNode {
  // A paragraph whose entire text is $$...$$ becomes a block math node.
  if (node.type === "paragraph" && node.content?.length) {
    const flat = node.content.map((c) => (c.type === "text" ? c.text ?? "" : "")).join("");
    const block = flat.trim().match(BLOCK_MATH);
    if (block && node.content.every((c) => c.type === "text")) {
      return { type: "blockMath", attrs: { latex: block[1].trim() } };
    }
  }
  if (node.type === "text" && node.text && node.text.includes("$") && !node.marks?.length) {
    const parts = splitInlineMath(node.text);
    if (parts.length > 1) return { type: "__fragment__", content: parts };
  }
  if (node.content) {
    const next: RichNode[] = [];
    for (const child of node.content) {
      const processed = injectMath(child);
      if (processed.type === "__fragment__" && processed.content) next.push(...processed.content);
      else next.push(processed);
    }
    return { ...node, content: next };
  }
  return node;
}

/** Parse a markdown/plaintext string into a canonical rich document. Never throws. */
export function markdownToDoc(markdown: string): RichDoc {
  if (!markdown.trim()) return fromProseMirrorDoc({ type: "doc", content: [{ type: "paragraph" }] });
  try {
    const pm = headlessJSON(markdown);
    const withMath = injectMath(pm as RichNode);
    return fromProseMirrorDoc({ type: "doc", content: withMath.content ?? [] });
  } catch {
    // Absolute fallback: one paragraph with the raw text, so content is never lost.
    return fromProseMirrorDoc({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: markdown }] }] });
  }
}

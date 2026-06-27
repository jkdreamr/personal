/**
 * Deterministic, dependency-free serialization of the canonical rich document to Markdown and
 * plaintext. Pure functions over the JSON model (no DOM, no editor instance) so they are fast,
 * testable in any environment, and produce stable output for exports and AI context.
 */
import type { RichDoc, RichMark, RichNode } from "./types";

type Doclike = { content?: RichNode[] } | null | undefined;

// ---- inline (text + marks) -------------------------------------------------

const MARK_WRAP: Record<string, (s: string, attrs?: Record<string, unknown>) => string> = {
  code: (s) => "`" + s + "`",
  bold: (s) => `**${s}**`,
  italic: (s) => `*${s}*`,
  strike: (s) => `~~${s}~~`,
  underline: (s) => `<u>${s}</u>`, // markdown has no underline; preserve it semantically
  link: (s, attrs) => `[${s}](${(attrs?.href as string) ?? ""})`,
};

// Apply marks inner→outer in a stable order so output is deterministic.
const MARK_ORDER = ["code", "underline", "strike", "italic", "bold", "link"];

function applyMarks(text: string, marks?: RichMark[]): string {
  if (!marks?.length) return text;
  const present = MARK_ORDER.filter((m) => marks.some((k) => k.type === m));
  let out = text;
  for (const m of present) {
    const mark = marks.find((k) => k.type === m);
    out = (MARK_WRAP[m] ?? ((s) => s))(out, mark?.attrs);
  }
  return out;
}

function serializeInline(nodes: RichNode[] | undefined): string {
  if (!nodes?.length) return "";
  let out = "";
  for (const n of nodes) {
    if (n.type === "text") out += applyMarks(n.text ?? "", n.marks);
    else if (n.type === "hardBreak") out += "  \n";
    else if (n.type === "inlineMath") out += `$${(n.attrs?.latex as string) ?? ""}$`;
    else if (n.content) out += serializeInline(n.content);
  }
  return out;
}

// ---- blocks ----------------------------------------------------------------

function indent(text: string, prefix: string): string {
  return text
    .split("\n")
    .map((l) => (l.length ? prefix + l : l))
    .join("\n");
}

function serializeListItem(item: RichNode, marker: (i: number) => string, index: number, checked?: boolean): string {
  const blocks = item.content ?? [];
  const lead = checked === undefined ? marker(index) : `- [${checked ? "x" : " "}] `;
  const pad = " ".repeat(lead.length);
  const parts: string[] = [];
  blocks.forEach((b, i) => {
    if (b.type === "bulletList" || b.type === "orderedList" || b.type === "taskList") {
      // Nested list: indent under the item.
      parts.push(indent(serializeBlock(b), pad));
    } else {
      const text = serializeBlock(b);
      parts.push(i === 0 ? lead + text : indent(text, pad));
    }
  });
  return parts.join("\n");
}

function serializeList(node: RichNode): string {
  const items = node.content ?? [];
  if (node.type === "taskList") {
    return items.map((it) => serializeListItem(it, () => "- ", 0, Boolean(it.attrs?.checked))).join("\n");
  }
  if (node.type === "orderedList") {
    const start = typeof node.attrs?.start === "number" ? (node.attrs.start as number) : 1;
    return items.map((it, i) => serializeListItem(it, () => `${start + i}. `, i)).join("\n");
  }
  return items.map((it) => serializeListItem(it, () => "- ", 0)).join("\n");
}

function serializeBlock(node: RichNode): string {
  switch (node.type) {
    case "paragraph":
      return serializeInline(node.content);
    case "heading": {
      const level = Math.min(6, Math.max(1, Number(node.attrs?.level) || 1));
      return `${"#".repeat(level)} ${serializeInline(node.content)}`;
    }
    case "bulletList":
    case "orderedList":
    case "taskList":
      return serializeList(node);
    case "blockquote":
      return indent((node.content ?? []).map(serializeBlock).join("\n\n"), "> ");
    case "codeBlock": {
      const lang = (node.attrs?.language as string) || "";
      const code = (node.content ?? []).map((c) => c.text ?? "").join("");
      return "```" + lang + "\n" + code + "\n```";
    }
    case "horizontalRule":
      return "---";
    case "blockMath":
      return "$$\n" + ((node.attrs?.latex as string) ?? "") + "\n$$";
    case "listItem":
    case "taskItem":
      return (node.content ?? []).map(serializeBlock).join("\n\n");
    default:
      // Unknown block: fall back to its inline text so nothing is silently dropped.
      return serializeInline(node.content);
  }
}

/** Serialize a rich document (or plain PM doc) to deterministic Markdown. */
export function docToMarkdown(doc: Doclike): string {
  if (!doc?.content?.length) return "";
  return doc.content.map(serializeBlock).join("\n\n").replace(/\n{3,}/g, "\n\n").trim();
}

// ---- plaintext -------------------------------------------------------------

function textOf(node: RichNode): string {
  if (node.type === "text") return node.text ?? "";
  if (node.type === "hardBreak") return "\n";
  if (node.type === "inlineMath" || node.type === "blockMath") return (node.attrs?.latex as string) ?? "";
  if (node.type === "horizontalRule") return "";
  const inner = (node.content ?? []).map(textOf);
  // Block-level children get separated by blank lines; inline children join directly.
  const isBlockContainer = ["doc", "bulletList", "orderedList", "taskList", "blockquote"].includes(node.type);
  return inner.join(isBlockContainer ? "\n" : "");
}

/** Serialize a rich document to clean plaintext (used for AI context and the .txt export). */
export function docToText(doc: Doclike): string {
  if (!doc?.content?.length) return "";
  return doc.content
    .map(textOf)
    .join("\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Word count over the plaintext projection — used by the editor status line. */
export function docWordCount(doc: Doclike): number {
  const text = docToText(doc).trim();
  return text ? text.split(/\s+/).length : 0;
}

export type { RichDoc };

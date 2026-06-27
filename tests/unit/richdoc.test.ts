// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import {
  docToMarkdown,
  docToText,
  docWordCount,
  markdownToDoc,
  legacyBodyToDoc,
  resolveDoc,
  needsMigration,
  isRichDoc,
  isDocEmpty,
  emptyDoc,
  RICHDOC_VERSION,
  type RichDoc,
} from "@/lib/richdoc";

// A hand-built canonical document exercising every node/mark we serialize.
const sample: RichDoc = {
  version: RICHDOC_VERSION,
  type: "doc",
  content: [
    { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Quarterly update" }] },
    {
      type: "paragraph",
      content: [
        { type: "text", text: "We " },
        { type: "text", text: "shipped", marks: [{ type: "bold" }] },
        { type: "text", text: " the " },
        { type: "text", text: "editor", marks: [{ type: "italic" }] },
        { type: "text", text: " and a " },
        { type: "text", text: "link", marks: [{ type: "link", attrs: { href: "https://example.com" } }] },
        { type: "text", text: "." },
      ],
    },
    {
      type: "bulletList",
      content: [
        { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "First" }] }] },
        { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Second" }] }] },
      ],
    },
    {
      type: "taskList",
      content: [
        { type: "taskItem", attrs: { checked: true }, content: [{ type: "paragraph", content: [{ type: "text", text: "Done" }] }] },
        { type: "taskItem", attrs: { checked: false }, content: [{ type: "paragraph", content: [{ type: "text", text: "Todo" }] }] },
      ],
    },
    { type: "blockquote", content: [{ type: "paragraph", content: [{ type: "text", text: "A quote" }] }] },
    { type: "codeBlock", attrs: { language: "ts" }, content: [{ type: "text", text: "const x = 1;" }] },
    { type: "horizontalRule" },
    { type: "paragraph", content: [{ type: "text", text: "Euler " }, { type: "inlineMath", attrs: { latex: "e^{i\\pi}+1=0" } }] },
    { type: "blockMath", attrs: { latex: "\\int_0^1 x\\,dx" } },
  ],
};

describe("rich document serialization (deterministic, pure)", () => {
  it("serializes every node/mark to stable Markdown", () => {
    const md = docToMarkdown(sample);
    expect(md).toContain("## Quarterly update");
    expect(md).toContain("**shipped**");
    expect(md).toContain("*editor*");
    expect(md).toContain("[link](https://example.com)");
    expect(md).toContain("- First");
    expect(md).toContain("- [x] Done");
    expect(md).toContain("- [ ] Todo");
    expect(md).toContain("> A quote");
    expect(md).toContain("```ts\nconst x = 1;\n```");
    expect(md).toContain("---");
    expect(md).toContain("$e^{i\\pi}+1=0$");
    expect(md).toContain("$$\n\\int_0^1 x\\,dx\n$$");
  });
  it("is deterministic (same input → identical output)", () => {
    expect(docToMarkdown(sample)).toBe(docToMarkdown(sample));
  });
  it("projects clean plaintext and a word count", () => {
    const text = docToText(sample);
    expect(text).toContain("Quarterly update");
    expect(text).toContain("We shipped the editor and a link.");
    expect(text).not.toContain("**");
    expect(text).not.toContain("- [x]");
    expect(docWordCount(sample)).toBeGreaterThan(5);
  });
  it("handles empty/edge docs without throwing", () => {
    expect(docToMarkdown(emptyDoc())).toBe("");
    expect(docToMarkdown(null)).toBe("");
    expect(docToText(undefined)).toBe("");
    expect(isDocEmpty(emptyDoc())).toBe(true);
    expect(isDocEmpty(sample)).toBe(false);
  });
});

describe("markdown → document parsing", () => {
  it("parses common markdown into the canonical schema", () => {
    const doc = markdownToDoc("## Title\n\nHello **world** and *italics*.\n\n- a\n- b");
    expect(isRichDoc(doc)).toBe(true);
    expect(doc.version).toBe(RICHDOC_VERSION);
    const md = docToMarkdown(doc);
    expect(md).toContain("## Title");
    expect(md).toContain("**world**");
    expect(md).toContain("- a");
  });
  it("round-trips checklists", () => {
    const doc = markdownToDoc("- [x] done\n- [ ] open");
    const md = docToMarkdown(doc);
    expect(md).toContain("- [x] done");
    expect(md).toContain("- [ ] open");
  });
  it("converts inline and block math from $...$ / $$...$$", () => {
    const inline = markdownToDoc("Euler: $e^{i\\pi}+1=0$ is famous.");
    expect(JSON.stringify(inline)).toContain('"inlineMath"');
    expect(docToMarkdown(inline)).toContain("$e^{i\\pi}+1=0$");

    const block = markdownToDoc("$$\n\\int_0^1 x\\,dx\n$$");
    expect(JSON.stringify(block)).toContain('"blockMath"');
    expect(docToMarkdown(block)).toContain("\\int_0^1 x");
  });
  it("never throws on malformed math or input; content is preserved", () => {
    expect(() => markdownToDoc("broken $\\frac{1}{ math")).not.toThrow();
    const doc = markdownToDoc("broken $\\frac{1}{ math");
    expect(docToText(doc)).toContain("broken");
    expect(() => docToMarkdown(doc)).not.toThrow();
  });
});

describe("legacy migration", () => {
  it("upgrades a legacy markdown editedBody into a canonical doc", () => {
    const doc = legacyBodyToDoc("## Heading\n\nBody **bold**.\n\n- one\n- two");
    expect(isRichDoc(doc)).toBe(true);
    const md = docToMarkdown(doc);
    expect(md).toContain("## Heading");
    expect(md).toContain("**bold**");
    expect(md).toContain("- one");
  });
  it("resolves documents in precedence order: doc > editedBody > none", () => {
    const canonical = markdownToDoc("# Canonical");
    expect(resolveDoc({ doc: canonical, editedBody: "ignored legacy" })).toBe(canonical);
    const migrated = resolveDoc({ editedBody: "legacy body" });
    expect(migrated && isRichDoc(migrated)).toBe(true);
    expect(docToText(migrated)).toContain("legacy body");
    expect(resolveDoc({})).toBeNull();
    expect(resolveDoc(null)).toBeNull();
  });
  it("flags only legacy-only sources as needing migration", () => {
    expect(needsMigration({ editedBody: "legacy" })).toBe(true);
    expect(needsMigration({ doc: markdownToDoc("x"), editedBody: "legacy" })).toBe(false);
    expect(needsMigration({})).toBe(false);
  });
});

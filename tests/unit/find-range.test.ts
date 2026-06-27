// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { Editor } from "@tiptap/core";
import { RICHDOC_EXTENSIONS } from "@/lib/richdoc/extensions";
import { findRanges, findAnchoredRange } from "@/lib/richdoc/find-range";

let editor: Editor | null = null;
function make(content: string): Editor {
  editor = new Editor({ element: document.createElement("div"), extensions: RICHDOC_EXTENSIONS, content });
  return editor;
}
afterEach(() => {
  editor?.destroy();
  editor = null;
});

describe("findAnchoredRange — occurrence safety for repeated wording", () => {
  it("finds every occurrence of a repeated phrase", () => {
    const e = make("<p>The plan is ready. The plan is late.</p>");
    expect(findRanges(e, "The plan").length).toBe(2);
  });

  it("anchors to the correct occurrence via after-context", () => {
    const e = make("<p>The plan is ready. The plan is late.</p>");
    const r = findAnchoredRange(e, "is", { after: " late" });
    expect(r).not.toBeNull();
    const following = e.state.doc.textBetween(r!.to, Math.min(e.state.doc.content.size, r!.to + 6), "\n", " ");
    expect(following.startsWith(" late")).toBe(true);
  });

  it("anchors to the correct occurrence via before-context", () => {
    const e = make("<p>ship the editor, then ship the deck</p>");
    const r = findAnchoredRange(e, "ship", { before: "then " });
    expect(r).not.toBeNull();
    const preceding = e.state.doc.textBetween(Math.max(0, r!.from - 5), r!.from, "\n", " ");
    expect(preceding.endsWith("then ")).toBe(true);
  });

  it("refuses to guess when a repeated target has no disambiguating anchor", () => {
    const e = make("<p>go now and go later</p>");
    expect(findRanges(e, "go").length).toBe(2);
    expect(findAnchoredRange(e, "go")).toBeNull(); // ambiguous → safe drop, never the wrong one
  });

  it("a unique target resolves with or without anchors", () => {
    const e = make("<p>The quarterly review is on Friday.</p>");
    expect(findAnchoredRange(e, "quarterly review")).not.toBeNull();
    expect(findAnchoredRange(e, "quarterly review", { before: "The " })).not.toBeNull();
  });
});

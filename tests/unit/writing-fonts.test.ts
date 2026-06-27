import { describe, it, expect } from "vitest";
import { fontStack, WRITING_FONTS, DEFAULT_WRITING_FONT } from "@/lib/client/writing-fonts";

describe("writing fonts", () => {
  it("offers a small, readable, system-only set (no downloads)", () => {
    expect(WRITING_FONTS.map((f) => f.id)).toEqual(["sans", "serif", "book", "mono"]);
    // No web-font URLs — every option is a system stack.
    for (const f of WRITING_FONTS) expect(f.stack).not.toMatch(/url\(|https?:/);
  });
  it("resolves each id to its stack and falls back for unknown ids", () => {
    for (const f of WRITING_FONTS) expect(fontStack(f.id)).toBe(f.stack);
    expect(fontStack("nonexistent")).toBe(WRITING_FONTS[0].stack);
    expect(DEFAULT_WRITING_FONT).toBe("sans");
  });
});

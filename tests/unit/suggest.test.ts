import { describe, it, expect } from "vitest";
import { demoSuggest } from "@/lib/ai/demo-suggest";
import { suggestResponseSchema, SUGGESTION_CATEGORIES } from "@/lib/ai/suggest-schema";

describe("demo suggestions", () => {
  it("returns exact-substring targets that exist in the draft (so they can be located)", () => {
    const text = "We will utilize a robust plan to leverage the team.";
    const res = demoSuggest(text, "a clear update");
    expect(res.suggestions.length).toBeGreaterThan(0);
    for (const s of res.suggestions) {
      expect(text).toContain(s.target);
      expect(SUGGESTION_CATEGORIES).toContain(s.category);
    }
    expect(suggestResponseSchema.safeParse(res).success).toBe(true);
  });

  it("surfaces a generous, varied set (not just a couple) and always includes overall direction", () => {
    const text = "utilize leverage robust holistic game-changing synergy a number of in order to very unique";
    const res = demoSuggest(text);
    // A real markup pass marks up a lot — many distinct issues here, capped at 12.
    expect(res.suggestions.length).toBeGreaterThan(6);
    expect(res.suggestions.length).toBeLessThanOrEqual(12);
    // The set spans more than one kind of fix.
    expect(new Set(res.suggestions.map((s) => s.category)).size).toBeGreaterThan(1);
    expect(res.overall.length).toBeGreaterThan(0);
  });

  it("returns nothing actionable for clean prose (no false targets)", () => {
    const res = demoSuggest("Thanks for the quick turnaround. The plan looks ready to ship on Friday.");
    expect(res.suggestions).toEqual([]);
  });
});

describe("suggestion contract", () => {
  it("accepts a valid response and rejects a bad category", () => {
    expect(suggestResponseSchema.safeParse({ suggestions: [], overall: [] }).success).toBe(true);
    expect(
      suggestResponseSchema.safeParse({
        suggestions: [{ target: "x", replacement: "y", category: "clarity", rationale: "clearer" }],
        overall: ["lead with the point"],
      }).success
    ).toBe(true);
    expect(
      suggestResponseSchema.safeParse({ suggestions: [{ target: "x", replacement: "y", category: "bogus", rationale: "z" }], overall: [] }).success
    ).toBe(false);
  });
});

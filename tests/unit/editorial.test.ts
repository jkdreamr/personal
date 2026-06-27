import { describe, it, expect } from "vitest";
import { lintText } from "@/lib/editorial/style-lint";
import { editorialPass } from "@/lib/editorial/editorial-pass";
import { canUseVoiceProfile, emptyVoiceProfile, suggestFromSamples } from "@/lib/editorial/voice-profile";

describe("style lint (warnings, never auto-edits)", () => {
  it("flags clichés", () => {
    const w = lintText("In today's rapidly evolving landscape, we leverage robust solutions.");
    expect(w.some((x) => x.kind === "cliche")).toBe(true);
  });
  it("flags excessive exclamation marks", () => {
    const w = lintText("Great! Amazing! Wonderful! Fantastic!");
    expect(w.some((x) => x.kind === "exclamation")).toBe(true);
  });
  it("returns nothing for clean prose", () => {
    const w = lintText("We shipped the migration on Tuesday. Two issues remain.");
    expect(w.length).toBe(0);
  });
});

describe("editorial pass", () => {
  it("produces editable suggestions across dimensions", () => {
    const { suggestions } = editorialPass(
      "In conclusion, we leverage robust holistic synergy. We leverage. We leverage. We delve into things."
    );
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions.every((s) => typeof s.note === "string" && s.note.length > 0)).toBe(true);
  });
});

describe("voice profile opt-in", () => {
  it("requires both enabled AND task confirmation", () => {
    const p = emptyVoiceProfile();
    expect(canUseVoiceProfile(p, true)).toBe(false); // not enabled
    p.enabled = true;
    expect(canUseVoiceProfile(p, false)).toBe(false); // not confirmed for task
    expect(canUseVoiceProfile(p, true)).toBe(true);
    expect(canUseVoiceProfile(null, true)).toBe(false);
  });
  it("suggests settings from samples without applying them automatically", () => {
    const s = suggestFromSamples(["Hi team, Quick update: shipped it. Best, J"]);
    expect(s.sentenceLength).toBeDefined();
  });
});

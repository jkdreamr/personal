import { describe, it, expect } from "vitest";
import { buildContext } from "@/lib/ai/prompts";
import { SERVICES, type ServiceId } from "@/lib/services";

describe("existing-draft support", () => {
  it("enables draft entry only where a user often has existing text", () => {
    const yes: ServiceId[] = ["notes", "present", "proposal", "meeting"];
    const no: ServiceId[] = ["research", "verify", "compare", "decide", "explain", "challenge", "brief"];
    for (const id of yes) expect(SERVICES[id].capabilities.acceptsDraft).toBe(true);
    for (const id of no) expect(SERVICES[id].capabilities.acceptsDraft).toBe(false);
    // Draft-capable services declare a CTA + placeholder.
    for (const id of yes) {
      expect(SERVICES[id].draftCta).toBeTruthy();
      expect(SERVICES[id].draftPlaceholder).toBeTruthy();
    }
  });

  it("injects the draft as primary material with an improve-not-restart instruction", () => {
    const ctx = buildContext({
      service: SERVICES.notes,
      goal: "make it concise",
      attachments: [],
      sources: [],
      adjustments: {},
      draft: "My rough notes about the Q3 launch plan.",
    });
    expect(ctx).toContain("EXISTING DRAFT");
    expect(ctx).toMatch(/do not start from scratch/i);
    expect(ctx).toContain("My rough notes about the Q3 launch plan.");
    // The "focus" still flows in as the task line.
    expect(ctx).toContain("make it concise");
  });

  it("omits the draft block when there is no draft", () => {
    const ctx = buildContext({ service: SERVICES.notes, goal: "organize these", attachments: [], sources: [], adjustments: {} });
    expect(ctx).not.toContain("EXISTING DRAFT");
  });
});

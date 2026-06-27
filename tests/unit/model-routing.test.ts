import { describe, it, expect, vi, beforeEach } from "vitest";
import { modelEnabled } from "@/lib/ai/providers";

// modelEnabled depends on which provider keys are configured. The test env has no keys, so mock it
// to control which providers are "enabled" and assert chainFor's ordering + filtering directly.
vi.mock("@/lib/ai/providers", () => ({ modelEnabled: vi.fn(() => true) }));

import { MODELS, EXTRA_MODELS, chainFor, isFreeModel, assertFreeModel, type TaskKind } from "@/lib/ai/model-router";
import { getCapabilities, __resetCapabilityCache } from "@/lib/ai/provider-capabilities";

const enabled = vi.mocked(modelEnabled);
const LEAN_KINDS: TaskKind[] = ["autocomplete", "title", "classify"];
const EXHAUSTIVE_KINDS: TaskKind[] = ["synthesis", "rewrite", "second_opinion"];
const ALL_KINDS: TaskKind[] = [...LEAN_KINDS, ...EXHAUSTIVE_KINDS];

beforeEach(() => {
  enabled.mockReset();
  enabled.mockReturnValue(true); // every provider configured, by default
});

describe("money safety", () => {
  it("never uses paid models or auto (free-tier models only)", () => {
    const ids = [...Object.values(MODELS), ...Object.values(EXTRA_MODELS)];
    expect(ids).not.toContain("openrouter/auto");
    const knownFree = new Set<string>(["openrouter/owl-alpha", "mistral-small-latest"]);
    expect(ids.every((m) => m.includes(":free") || m.includes("::") || knownFree.has(m))).toBe(true);
  });
  it("the free-model guard accepts every model we use and rejects paid ones", () => {
    for (const m of [...Object.values(MODELS), ...Object.values(EXTRA_MODELS)]) {
      expect(isFreeModel(m)).toBe(true);
      expect(() => assertFreeModel(m)).not.toThrow();
    }
    expect(isFreeModel("openai/gpt-4o")).toBe(false);
    expect(() => assertFreeModel("anthropic/claude-3.5-sonnet")).toThrow(/non-free/);
    expect(isFreeModel("deepseek/deepseek-r1:free")).toBe(true);
  });
  it("every chain only ever yields free models, deduplicated, in every config", () => {
    for (const kind of ALL_KINDS) {
      for (const m of chainFor(kind)) expect(isFreeModel(m)).toBe(true);
    }
    // Including each synthesis strength.
    for (const pref of ["primary", "reviewer", "fast"] as const) {
      const chain = chainFor("synthesis", pref);
      expect(new Set(chain).size).toBe(chain.length);
      for (const m of chain) expect(isFreeModel(m)).toBe(true);
    }
  });
  it("Laguna is in the map but never auto-used in any chain", () => {
    expect(MODELS.restricted).toBe("poolside/laguna-m.1:free");
    for (const kind of ALL_KINDS) expect(chainFor(kind)).not.toContain(MODELS.restricted);
    for (const pref of ["primary", "reviewer", "fast"] as const) expect(chainFor("synthesis", pref)).not.toContain(MODELS.restricted);
  });
});

describe("routing each model to its strength (chainFor)", () => {
  it("leads latency-sensitive work with the fastest providers", () => {
    expect(chainFor("autocomplete")[0]).toBe(EXTRA_MODELS.cerebras8b);
    expect(chainFor("title")[0]).toBe(EXTRA_MODELS.groq8b);
    expect(chainFor("classify")[0]).toBe(EXTRA_MODELS.groq8b);
    expect(chainFor("rewrite")[0]).toBe(EXTRA_MODELS.groq70b);
  });
  it("leads synthesis by the service's declared strength", () => {
    // Default / most services → Owl, with Gemini (huge context) as the first cross-provider fallback.
    expect(chainFor("synthesis")[0]).toBe(MODELS.primary);
    expect(chainFor("synthesis")[1]).toBe(EXTRA_MODELS.gemini);
    expect(chainFor("synthesis", "primary")[0]).toBe(MODELS.primary);
    // Reasoning/adversarial (Challenge) → Nemotron leads, Owl right behind.
    expect(chainFor("synthesis", "reviewer")[0]).toBe(MODELS.reviewer);
    expect(chainFor("synthesis", "reviewer")[1]).toBe(MODELS.primary);
    // Light structuring (Notes) → fastest capable model leads, Owl as the quality backstop.
    expect(chainFor("synthesis", "fast")[0]).toBe(EXTRA_MODELS.groq70b);
    expect(chainFor("synthesis", "fast")).toContain(MODELS.primary);
  });
  it("routes an explicit second opinion to a strong, different reviewer", () => {
    expect(chainFor("second_opinion")[0]).toBe(MODELS.reviewer);
  });
});

describe("always-a-fallback (no errors)", () => {
  it("quality kinds include EVERY configured model (exhaustive safety net)", () => {
    const all = new Set([...Object.values(MODELS).filter((m) => m !== MODELS.restricted), ...Object.values(EXTRA_MODELS)]);
    for (const kind of EXHAUSTIVE_KINDS) {
      const chain = new Set(chainFor(kind));
      for (const m of all) expect(chain.has(m)).toBe(true); // nothing free is left out as a last resort
    }
    // The tiny 8B models are present but last (never the lead for a quality task).
    const syn = chainFor("synthesis");
    expect(syn).toContain(EXTRA_MODELS.groq8b);
    expect(syn.indexOf(EXTRA_MODELS.groq8b)).toBeGreaterThan(syn.indexOf(MODELS.primary));
  });
  it("lean kinds stay lean — no heavy reviewer/mistral tail (best-effort, silent on failure)", () => {
    for (const kind of LEAN_KINDS) {
      const chain = chainFor(kind);
      expect(chain).not.toContain(MODELS.reviewer);
      expect(chain).not.toContain(MODELS.mistral);
    }
  });
  it("degrades cleanly to OpenRouter-only (the common deploy)", () => {
    enabled.mockImplementation((m: string) => !m.includes("::") && !m.startsWith("mistral"));
    expect(chainFor("synthesis")).toEqual([MODELS.primary, MODELS.fast, MODELS.reviewer]);
    expect(chainFor("synthesis", "reviewer")).toEqual([MODELS.reviewer, MODELS.primary, MODELS.fast]);
    expect(chainFor("synthesis", "fast")).toEqual([MODELS.fast, MODELS.primary, MODELS.reviewer]);
    expect(chainFor("rewrite")).toEqual([MODELS.fast, MODELS.primary, MODELS.reviewer]);
    expect(chainFor("autocomplete")).toEqual([MODELS.fast, MODELS.primary]);
  });
  it("works even with a single non-OpenRouter provider (e.g. Groq only)", () => {
    enabled.mockImplementation((m: string) => m.startsWith("groq::"));
    expect(chainFor("synthesis")).toEqual([EXTRA_MODELS.groq70b, EXTRA_MODELS.groq8b]);
    expect(chainFor("autocomplete")[0]).toBe(EXTRA_MODELS.groq8b);
    for (const kind of ALL_KINDS) expect(chainFor(kind).length).toBeGreaterThan(0);
  });
  it("prefers extra providers ahead of OpenRouter when their keys are present", () => {
    enabled.mockImplementation((m: string) => m.startsWith("groq::") || (!m.includes("::") && !m.startsWith("mistral")));
    const chain = chainFor("rewrite");
    expect(chain[0]).toBe(EXTRA_MODELS.groq70b);
    expect(chain).toContain(MODELS.fast); // OpenRouter free still present as a fallback
    expect(chain).not.toContain(EXTRA_MODELS.cerebras70b); // Cerebras disabled
  });
  it("returns an empty chain only when NO provider is configured", () => {
    enabled.mockReturnValue(false);
    for (const kind of ALL_KINDS) expect(chainFor(kind)).toEqual([]);
  });
});

describe("provider capabilities (no key → safe default, no network)", () => {
  it("returns jsonMode false when capabilities are unknown", async () => {
    __resetCapabilityCache();
    const caps = await getCapabilities(MODELS.primary);
    expect(caps.jsonMode).toBe(false);
    expect(caps.imageInput).toBe(false);
  });
});

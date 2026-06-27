import { describe, it, expect, vi, beforeEach } from "vitest";
import { modelEnabled } from "@/lib/ai/providers";

// modelEnabled depends on which provider keys are configured. The test env has no keys, so mock it
// to control which providers are "enabled" and assert chainFor's ordering + filtering directly.
vi.mock("@/lib/ai/providers", () => ({ modelEnabled: vi.fn(() => true) }));

import { MODELS, EXTRA_MODELS, routeModel, fallbackChain, chainFor, isFreeModel, assertFreeModel, type TaskKind } from "@/lib/ai/model-router";
import { getCapabilities, __resetCapabilityCache } from "@/lib/ai/provider-capabilities";

const enabled = vi.mocked(modelEnabled);
const ALL_KINDS: TaskKind[] = ["synthesis", "rewrite", "classify", "title", "autocomplete", "second_opinion"];

beforeEach(() => {
  enabled.mockReset();
  enabled.mockReturnValue(true); // every provider configured, by default
});

describe("model routing", () => {
  it("uses the fast model only for trivial kinds", () => {
    expect(routeModel("primary", "autocomplete")).toBe(MODELS.fast);
    expect(routeModel("primary", "title")).toBe(MODELS.fast);
    expect(routeModel("primary", "classify")).toBe(MODELS.fast);
    expect(routeModel("primary", "rewrite")).toBe(MODELS.fast);
  });
  it("routes ALL synthesis to Owl Alpha by default, regardless of service preference", () => {
    expect(routeModel("primary", "synthesis")).toBe(MODELS.primary);
    expect(routeModel("reviewer", "synthesis")).toBe(MODELS.primary);
    expect(routeModel("fast", "synthesis")).toBe(MODELS.primary);
  });
  it("routes an explicit second opinion to the reviewer model", () => {
    expect(routeModel("primary", "second_opinion")).toBe(MODELS.reviewer);
  });
  it("never uses paid models or auto (free-tier models only)", () => {
    const ids = [...Object.values(MODELS), ...Object.values(EXTRA_MODELS)];
    expect(ids).not.toContain("openrouter/auto");
    // Accept: `:free` OpenRouter models, the free owl-alpha stealth model, Mistral's free-tier
    // model, and the tagged free-provider models (Groq/Cerebras/Google) using `provider::model`.
    const knownFree = new Set<string>(["openrouter/owl-alpha", "mistral-small-latest"]);
    expect(ids.every((m) => m.includes(":free") || m.includes("::") || knownFree.has(m))).toBe(true);
  });
  it("the free-model guard accepts every model we use and rejects paid ones", () => {
    for (const m of [...Object.values(MODELS), ...Object.values(EXTRA_MODELS)]) {
      expect(isFreeModel(m)).toBe(true);
      expect(() => assertFreeModel(m)).not.toThrow();
    }
    expect(isFreeModel("openai/gpt-4o")).toBe(false);
    expect(isFreeModel("anthropic/claude-3.5-sonnet")).toBe(false);
    expect(() => assertFreeModel("openai/gpt-4o")).toThrow(/non-free/);
    // a `:free` variant is accepted defensively
    expect(isFreeModel("deepseek/deepseek-r1:free")).toBe(true);
  });
  it("includes Laguna in the map but never auto-uses it (disabled by default)", () => {
    expect(MODELS.restricted).toBe("poolside/laguna-m.1:free");
    expect(fallbackChain(MODELS.primary)).not.toContain(MODELS.restricted);
    expect(fallbackChain(MODELS.reviewer)).not.toContain(MODELS.restricted);
    for (const kind of ALL_KINDS) expect(chainFor(kind)).not.toContain(MODELS.restricted);
  });
  it("degrades Owl -> GPT-OSS -> Nemotron for resilience (Nemotron last, never first)", () => {
    const chain = fallbackChain(MODELS.primary);
    expect(chain[0]).toBe(MODELS.primary);
    expect(chain[1]).toBe(MODELS.fast);
    expect(chain[chain.length - 1]).toBe(MODELS.reviewer); // last resort only
    expect(new Set(chain).size).toBe(chain.length);
  });
});

describe("task-aware chains (chainFor)", () => {
  it("orders each kind by its best-fit model first", () => {
    // Autocomplete/trivial = latency first → Cerebras/Groq small models lead.
    expect(chainFor("autocomplete")[0]).toBe(EXTRA_MODELS.cerebras8b);
    expect(chainFor("title")[0]).toBe(EXTRA_MODELS.groq8b);
    expect(chainFor("classify")[0]).toBe(EXTRA_MODELS.groq8b);
    // Rewrite = quick but quality matters → a fast 70B leads.
    expect(chainFor("rewrite")[0]).toBe(EXTRA_MODELS.groq70b);
    // Synthesis = quality first → Owl leads, Gemini (huge context) is the first cross-provider fallback.
    expect(chainFor("synthesis")[0]).toBe(MODELS.primary);
    expect(chainFor("synthesis")[1]).toBe(EXTRA_MODELS.gemini);
    // Second opinion = a strong, different reviewer leads.
    expect(chainFor("second_opinion")[0]).toBe(MODELS.reviewer);
  });
  it("only ever yields free models, deduplicated", () => {
    for (const kind of ALL_KINDS) {
      const chain = chainFor(kind);
      expect(chain.length).toBeGreaterThan(0);
      expect(new Set(chain).size).toBe(chain.length);
      for (const m of chain) expect(isFreeModel(m)).toBe(true);
    }
  });
  it("drops models whose provider has no key (only OpenRouter configured)", () => {
    // Disable every tagged provider + Mistral; keep OpenRouter native ids.
    enabled.mockImplementation((m: string) => !m.includes("::") && !m.startsWith("mistral"));
    expect(chainFor("autocomplete")).toEqual([MODELS.fast, MODELS.primary]);
    expect(chainFor("synthesis")).toEqual([MODELS.primary, MODELS.fast, MODELS.reviewer]);
    expect(chainFor("rewrite")).toEqual([MODELS.fast, MODELS.primary]);
  });
  it("includes the extra providers ahead of OpenRouter when their keys are present", () => {
    // Only Groq + OpenRouter enabled (no Cerebras/Google/Mistral).
    enabled.mockImplementation((m: string) => m.startsWith("groq::") || (!m.includes("::") && !m.startsWith("mistral")));
    const chain = chainFor("rewrite");
    expect(chain[0]).toBe(EXTRA_MODELS.groq70b); // Groq leads
    expect(chain).toContain(MODELS.fast); // OpenRouter free still present as a fallback
    expect(chain).not.toContain(EXTRA_MODELS.cerebras70b); // Cerebras disabled
  });
  it("returns an empty chain when no provider key is configured", () => {
    enabled.mockReturnValue(false);
    expect(chainFor("synthesis")).toEqual([]);
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

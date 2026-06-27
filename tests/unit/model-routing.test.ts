import { describe, it, expect } from "vitest";
import { MODELS, routeModel, fallbackChain } from "@/lib/ai/model-router";
import { getCapabilities, __resetCapabilityCache } from "@/lib/ai/provider-capabilities";

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
  it("never uses paid models or auto", () => {
    const ids = Object.values(MODELS);
    expect(ids).not.toContain("openrouter/auto");
    expect(ids.every((m) => m.includes(":free") || m === "openrouter/owl-alpha")).toBe(true);
  });
  it("includes Laguna in the map but never auto-uses it (disabled by default)", () => {
    expect(MODELS.restricted).toBe("poolside/laguna-m.1:free");
    // It must not appear in any fallback chain.
    expect(fallbackChain(MODELS.primary)).not.toContain(MODELS.restricted);
    expect(fallbackChain(MODELS.reviewer)).not.toContain(MODELS.restricted);
  });
  it("degrades Owl -> GPT-OSS -> Nemotron for resilience (Nemotron last, never first)", () => {
    const chain = fallbackChain(MODELS.primary);
    expect(chain[0]).toBe(MODELS.primary);
    expect(chain[1]).toBe(MODELS.fast);
    expect(chain[chain.length - 1]).toBe(MODELS.reviewer); // last resort only
    expect(new Set(chain).size).toBe(chain.length);
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

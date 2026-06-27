import { describe, it, expect } from "vitest";
import { MODELS, routeModel, fallbackChain } from "@/lib/ai/model-router";
import { getCapabilities, __resetCapabilityCache } from "@/lib/ai/provider-capabilities";

describe("model routing", () => {
  it("uses the fast model for lightweight kinds", () => {
    expect(routeModel("primary", "autocomplete")).toBe(MODELS.fast);
    expect(routeModel("primary", "title")).toBe(MODELS.fast);
    expect(routeModel("reviewer", "classify")).toBe(MODELS.fast);
  });
  it("routes full synthesis by service preference", () => {
    expect(routeModel("primary", "synthesis")).toBe(MODELS.primary);
    expect(routeModel("reviewer", "synthesis")).toBe(MODELS.reviewer);
    expect(routeModel("fast", "synthesis")).toBe(MODELS.fast);
  });
  it("sends short rewrites to fast unless reviewer", () => {
    expect(routeModel("primary", "rewrite")).toBe(MODELS.fast);
    expect(routeModel("reviewer", "rewrite")).toBe(MODELS.reviewer);
  });
  it("never uses paid models or auto", () => {
    const ids = Object.values(MODELS);
    expect(ids).not.toContain("openrouter/auto");
    expect(ids.every((m) => m.includes(":free") || m === "openrouter/owl-alpha")).toBe(true);
  });
  it("fallback chain is the preferred model then approved free models, de-duped", () => {
    const chain = fallbackChain(MODELS.primary);
    expect(chain[0]).toBe(MODELS.primary);
    expect(chain).toContain(MODELS.fast);
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

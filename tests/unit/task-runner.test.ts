import { describe, it, expect, vi, beforeEach } from "vitest";

// Prove the reliability contract: a failing model (incl. an auth error from one bad provider key)
// advances to the next model in the chain; the task only errors when EVERY model fails.

const { chatMock } = vi.hoisted(() => ({ chatMock: vi.fn() }));

// All providers "configured" so chainFor yields its full multi-provider chain.
vi.mock("@/lib/ai/providers", () => ({ modelEnabled: vi.fn(() => true) }));
// Skip the network capability probe.
vi.mock("@/lib/ai/provider-capabilities", () => ({ getCapabilities: vi.fn(async () => ({ jsonMode: false, imageInput: false })) }));
// Replace only chatComplete; keep the real ProviderError so `instanceof` still holds.
vi.mock("@/lib/ai/openrouter-client", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/ai/openrouter-client")>();
  return { ...actual, chatComplete: chatMock };
});

import { runTask } from "@/lib/ai/task-runner";
import { ProviderError } from "@/lib/ai/openrouter-client";
import { chainFor } from "@/lib/ai/model-router";
import { EXTRA_MODELS } from "@/lib/ai/model-router";

const input = {
  service: "write",
  goal: "Write a short note.",
  attachments: [],
  sources: [],
  adjustments: {},
} as Parameters<typeof runTask>[0];

const validArtifact = JSON.stringify({ title: "Result", summary: "ok", sections: [] });

beforeEach(() => chatMock.mockReset());

describe("task runner — always a fallback (no errors)", () => {
  it("falls through an AUTH error (bad provider key) to the next model and succeeds", async () => {
    // Owl (first) returns a 401 as if its provider key were bad; Gemini (second) succeeds.
    chatMock.mockRejectedValueOnce(new ProviderError("Invalid key", 401, false)).mockResolvedValueOnce(validArtifact);

    const res = await runTask(input, false);

    expect(res.artifact.title).toBe("Result");
    // Used the SECOND model in the synthesis chain — auth on the first did not abort the task.
    expect(res.modelUsed).toBe(chainFor("synthesis", "primary")[1]);
    expect(res.modelUsed).toBe(EXTRA_MODELS.gemini);
  });

  it("falls through transient failures (rate limit, 5xx) until one model works", async () => {
    chatMock
      .mockRejectedValueOnce(new ProviderError("Rate limited", 429, true))
      .mockRejectedValueOnce(new ProviderError("Bad gateway", 502, true))
      .mockResolvedValueOnce(validArtifact);

    const res = await runTask(input, false);
    expect(res.artifact.title).toBe("Result");
    expect(res.modelUsed).toBe(chainFor("synthesis", "primary")[2]);
  });

  it("only errors when EVERY model in the (exhaustive) chain fails", async () => {
    const n = chainFor("synthesis", "primary").length;
    for (let i = 0; i < n; i++) chatMock.mockRejectedValueOnce(new ProviderError("down", 503, true));
    let threw = false;
    try {
      await runTask(input, false);
    } catch {
      threw = true;
    }
    expect(threw).toBe(true);
    // It actually tried the WHOLE chain, not just the first model.
    expect(chatMock.mock.calls.length).toBe(n);
  });

  it("user cancellation is the one thing that stops the chain immediately", async () => {
    const controller = new AbortController();
    controller.abort();
    chatMock.mockRejectedValueOnce(new ProviderError("aborted", 503, true));
    let threw = false;
    try {
      await runTask({ ...input, signal: controller.signal }, false);
    } catch {
      threw = true;
    }
    expect(threw).toBe(true);
    // Stopped after the first attempt rather than walking the whole chain.
    expect(chatMock.mock.calls.length).toBe(1);
  });
});

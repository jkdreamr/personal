import { describe, it, expect } from "vitest";
import { fitBeforeSuffix } from "@/lib/client/ghost-fit";

describe("fitBeforeSuffix — suffix-aware ghost safety", () => {
  it("closes the completion and separates it from the following text", () => {
    expect(fitBeforeSuffix("Here's why that matters", "The team is happy.")).toBe("Here's why that matters. ");
  });

  it("keeps existing terminal punctuation, just adds the separating space", () => {
    expect(fitBeforeSuffix("It ships Friday.", "Then we celebrate.")).toBe("It ships Friday. ");
    expect(fitBeforeSuffix("First, the setup,", "then the result")).toBe("First, the setup, ");
  });

  it("drops a completion that duplicates the text right after the cursor", () => {
    expect(fitBeforeSuffix("and the team is happy too", "The team is happy.")).toBeNull();
  });

  it("returns null for an empty completion", () => {
    expect(fitBeforeSuffix("   ", "The team is happy.")).toBeNull();
  });
});

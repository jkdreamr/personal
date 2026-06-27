import { describe, it, expect } from "vitest";
import { inferIntent, shouldAutoProceed } from "@/lib/intent";

describe("intent inference", () => {
  it("routes an email reply to write", () => {
    const g = inferIntent({ text: "help me reply to this email", attachmentKinds: ["text"], hasEmail: true });
    expect(g.service).toBe("write");
  });
  it("routes a photo of notes to notes", () => {
    const g = inferIntent({ text: "organize this", attachmentKinds: ["file"], hasImage: true });
    expect(g.service).toBe("notes");
  });
  it("routes meeting prep to meeting", () => {
    const g = inferIntent({ text: "research this company before my meeting tomorrow", attachmentKinds: ["link"] });
    expect(g.service).toBe("meeting");
  });
  it("routes risk-finding to challenge", () => {
    const g = inferIntent({ text: "what could go wrong with this proposal?", attachmentKinds: ["file"] });
    expect(g.service).toBe("challenge");
  });
  it("nudges two documents toward compare", () => {
    const g = inferIntent({ text: "look at these vendor documents", attachmentKinds: ["file", "file"], itemCount: 2 });
    expect(["compare", "research"]).toContain(g.service);
  });
  it("routes a contract to explain", () => {
    const g = inferIntent({ text: "explain what this contract means", attachmentKinds: ["file"] });
    expect(g.service).toBe("explain");
  });
  it("falls back to write with low confidence when nothing matches", () => {
    const g = inferIntent({ text: "asdf qwer", attachmentKinds: [] });
    expect(g.service).toBe("write");
    expect(shouldAutoProceed(g)).toBe(false);
  });
  it("auto-proceeds when confident", () => {
    const g = inferIntent({ text: "build a presentation deck to pitch investors", attachmentKinds: [] });
    expect(g.service).toBe("present");
    expect(shouldAutoProceed(g)).toBe(true);
  });
});

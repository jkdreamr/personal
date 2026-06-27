import { describe, it, expect } from "vitest";
import { parseLengthConstraints, lengthInstruction, hasLengthConstraint } from "@/lib/ai/constraints";

const one = (text: string) => parseLengthConstraints(text)[0];

describe("length constraint parsing", () => {
  it("parses word counts with bounds", () => {
    expect(one("Write a 300-word summary")).toEqual({ unit: "words", bound: "exact", value: 300 });
    expect(one("keep it under 100 words")).toEqual({ unit: "words", bound: "max", value: 100 });
    expect(one("no more than 50 words")).toEqual({ unit: "words", bound: "max", value: 50 });
    expect(one("at least 200 words")).toEqual({ unit: "words", bound: "min", value: 200 });
    expect(one("around 150 words")).toEqual({ unit: "words", bound: "around", value: 150 });
    expect(one("roughly 80 words")).toEqual({ unit: "words", bound: "around", value: 80 });
  });

  it("parses ranges", () => {
    expect(one("200-300 words")).toEqual({ unit: "words", bound: "range", value: 200, value2: 300 });
    expect(one("write 8 to 10 slides")).toEqual({ unit: "slides", bound: "range", value: 8, value2: 10 });
    expect(one("between 2 and 3 paragraphs")).toEqual({ unit: "paragraphs", bound: "range", value: 2, value2: 3 });
  });

  it("parses sentences, paragraphs, bullets, slides, characters, pages, lines", () => {
    expect(one("in two sentences")).toEqual({ unit: "sentences", bound: "exact", value: 2 });
    expect(one("3 paragraphs")).toEqual({ unit: "paragraphs", bound: "exact", value: 3 });
    expect(one("5 bullet points")).toEqual({ unit: "bullets", bound: "exact", value: 5 });
    expect(one("give me 5 points")).toEqual({ unit: "bullets", bound: "exact", value: 5 });
    expect(one("a 10-slide deck")).toEqual({ unit: "slides", bound: "exact", value: 10 });
    expect(one("under 280 characters")).toEqual({ unit: "characters", bound: "max", value: 280 });
    expect(one("a one-pager")).toEqual({ unit: "pages", bound: "exact", value: 1 });
    expect(one("two pages")).toEqual({ unit: "pages", bound: "exact", value: 2 });
    expect(one("6 lines")).toEqual({ unit: "lines", bound: "exact", value: 6 });
  });

  it("captures multiple distinct constraints", () => {
    const cs = parseLengthConstraints("Write 3 paragraphs, about 200 words total");
    expect(cs).toContainEqual({ unit: "paragraphs", bound: "exact", value: 3 });
    expect(cs).toContainEqual({ unit: "words", bound: "around", value: 200 });
  });

  it("does not fire on incidental numbers", () => {
    expect(parseLengthConstraints("Reply to Dana about the 3 meetings next week")).toEqual([]);
    expect(parseLengthConstraints("Summarize version 2 of the contract")).toEqual([]);
    expect(hasLengthConstraint("Write a warm follow-up email")).toBe(false);
  });

  it("builds a forceful, overriding instruction (or empty when none)", () => {
    expect(lengthInstruction("Write a warm note")).toBe("");
    const i = lengthInstruction("a 2-sentence reply, under 40 words");
    expect(i).toMatch(/LENGTH REQUIREMENT/);
    expect(i).toMatch(/OVERRIDES/);
    expect(i).toMatch(/exactly 2 sentences/);
    expect(i).toMatch(/at most 40 words/);
    // It tells the model which units to count.
    expect(i).toMatch(/count the sentences and words/);
  });
});

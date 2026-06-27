import { describe, it, expect } from "vitest";
import {
  parseLengthConstraints,
  parseFormatDirectives,
  parseLanguage,
  parseReadingLevel,
  parsePerson,
  outputRequirements,
  hasOutputRequirements,
  hasLengthConstraint,
} from "@/lib/ai/constraints";

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

  it("parses every unit", () => {
    expect(one("in two sentences")).toEqual({ unit: "sentences", bound: "exact", value: 2 });
    expect(one("3 paragraphs")).toEqual({ unit: "paragraphs", bound: "exact", value: 3 });
    expect(one("5 bullet points")).toEqual({ unit: "bullets", bound: "exact", value: 5 });
    expect(one("a 10-slide deck")).toEqual({ unit: "slides", bound: "exact", value: 10 });
    expect(one("under 280 characters")).toEqual({ unit: "characters", bound: "max", value: 280 });
    expect(one("a one-pager")).toEqual({ unit: "pages", bound: "exact", value: 1 });
    expect(one("6 lines")).toEqual({ unit: "lines", bound: "exact", value: 6 });
  });

  it("does not fire on incidental numbers", () => {
    expect(parseLengthConstraints("Reply to Dana about the 3 meetings next week")).toEqual([]);
    expect(parseLengthConstraints("Summarize version 2 of the contract")).toEqual([]);
    expect(hasLengthConstraint("Write a warm follow-up email")).toBe(false);
  });
});

describe("format directives", () => {
  it("detects structure requests", () => {
    expect(parseFormatDirectives("give me the key points as bullets")).toContain("bullets");
    expect(parseFormatDirectives("write this in prose, no bullet points")).toContain("prose");
    expect(parseFormatDirectives("lay it out as a table")).toContain("table");
    expect(parseFormatDirectives("a comparison table please")).toContain("table");
    expect(parseFormatDirectives("numbered steps")).toContain("numbered");
    expect(parseFormatDirectives("no headings")).toContain("no-headings");
    expect(parseFormatDirectives("start with a TL;DR")).toContain("tldr");
    expect(parseFormatDirectives("use a Q&A format")).toContain("qa");
    expect(parseFormatDirectives("make it a checklist")).toContain("checklist");
    expect(parseFormatDirectives("no emojis")).toContain("no-emojis");
  });

  it("prose/no-bullets overrides bullets", () => {
    const d = parseFormatDirectives("write in prose with no bullets");
    expect(d).toContain("prose");
    expect(d).not.toContain("bullets");
  });

  it("does not misfire on incidental phrasing", () => {
    expect(parseFormatDirectives("a friendly note about the conference table")).not.toContain("table");
    expect(parseFormatDirectives("update the timetable")).not.toContain("table");
    expect(parseFormatDirectives("he dodged a bullet")).not.toContain("bullets");
    expect(parseFormatDirectives("a calm, mature note")).toEqual([]);
  });
});

describe("language", () => {
  it("detects an explicit output language", () => {
    expect(parseLanguage("Write a follow-up in Spanish")).toBe("Spanish");
    expect(parseLanguage("Reply in French.")).toBe("French");
    expect(parseLanguage("translate this into German")).toBe("German");
    expect(parseLanguage("a Japanese version of the brief")).toBe("Japanese");
    expect(parseLanguage("Draft the email in Portuguese, please")).toBe("Portuguese");
  });
  it("does not misfire on topical mentions of a language/place", () => {
    expect(parseLanguage("Research the Spanish wine market")).toBeNull();
    expect(parseLanguage("Compare French and German cars")).toBeNull();
    expect(parseLanguage("A note about our Chinese suppliers")).toBeNull();
  });
});

describe("reading level + point of view", () => {
  it("detects plain-language requests", () => {
    expect(parseReadingLevel("explain in plain English")).toBeTruthy();
    expect(parseReadingLevel("ELI5 please")).toBeTruthy();
    expect(parseReadingLevel("for a 10-year-old")).toBeTruthy();
    expect(parseReadingLevel("keep it non-technical, no jargon")).toBeTruthy();
    expect(parseReadingLevel("a normal professional brief")).toBeNull();
  });
  it("detects point of view", () => {
    expect(parsePerson("write in the first person")).toMatch(/first person/);
    expect(parsePerson("third-person summary")).toMatch(/third person/);
    expect(parsePerson("a normal summary")).toBeNull();
  });
});

describe("unified output requirements", () => {
  it("returns empty when nothing explicit is present", () => {
    expect(outputRequirements("Write a warm follow-up email to Dana")).toBe("");
    expect(hasOutputRequirements("Prep me for the meeting")).toBe(false);
  });
  it("combines every detected requirement into one forceful, overriding block", () => {
    const r = outputRequirements("In Spanish, 3 bullet points, under 60 words, in plain English");
    expect(r).toMatch(/OUTPUT REQUIREMENTS/);
    expect(r).toMatch(/OVERRIDE/);
    expect(r).toMatch(/exactly 3 bullets|at most 60 words/);
    expect(r).toMatch(/bulleted list/);
    expect(r).toMatch(/in Spanish/);
    expect(r).toMatch(/plain, simple language/);
  });
  it("works whether the request sits in the goal or the context", () => {
    expect(hasOutputRequirements(undefined, "make it exactly 2 sentences")).toBe(true);
    expect(hasOutputRequirements("Write 5 bullets", "ignored long context")).toBe(true);
  });
});

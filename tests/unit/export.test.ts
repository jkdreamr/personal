import { describe, it, expect } from "vitest";
import { artifactToMarkdown } from "@/lib/export/markdown";
import { artifactToText, emailToText } from "@/lib/export/text";
import { comparisonToCsv, comparisonToTsv } from "@/lib/export/csv";
import { exportFilename, slugify } from "@/lib/export/filename";
import { buildEvidencePackage } from "@/lib/export/json-evidence";
import type { Artifact } from "@/lib/types";

const artifact: Artifact = {
  service: "brief",
  title: "Acme Brief",
  summary: "One-line summary.",
  sections: [{ heading: "Overview", body: "Acme makes **widgets**.\n\n- point one\n- point two" }],
  assumptions: ["Professional audience."],
  claims: [
    { id: "c1", text: "Acme makes widgets", classification: "verified_fact", sourceIds: ["s1"], supportingExcerpts: ["Acme makes widgets."], confidence: "high" },
  ],
  sources: [{ id: "s1", title: "Acme About", canonicalUrl: "https://acme.com/about", publisher: "acme.com", trustTier: "primary", retrievedAt: "2026-06-26T00:00:00Z", excerpt: "Acme makes widgets." }],
  openQuestions: ["What is revenue?"],
  nextActions: ["Confirm with the team."],
  coverageNote: "Based on provided sources.",
};

describe("markdown export", () => {
  it("includes title, sections, claims, sources, and limitations; no internal data", () => {
    const md = artifactToMarkdown(artifact);
    expect(md).toContain("# Acme Brief");
    expect(md).toContain("## Overview");
    expect(md).toContain("Claims and evidence");
    expect(md).toContain("Verified fact");
    expect(md).toContain("Sources and limitations");
    expect(md).toContain("https://acme.com/about");
    expect(md).not.toMatch(/system prompt|chain-of-thought|OPENROUTER/i);
  });
  it("uses edited body when provided", () => {
    const md = artifactToMarkdown(artifact, { editedBody: "My own edited text." });
    expect(md).toContain("My own edited text.");
    expect(md).not.toContain("## Overview");
  });
});

describe("text export", () => {
  it("strips markdown markers", () => {
    const txt = artifactToText(artifact);
    expect(txt).not.toContain("**");
    expect(txt).toContain("Acme makes widgets");
  });
  it("emailToText returns null without an email", () => {
    expect(emailToText(artifact)).toBeNull();
  });
});

describe("comparison csv/tsv", () => {
  const table = { options: ["A", "B"], criteria: [{ label: "Cost", values: ["$10", "$20"] }, { label: "Note", values: ["has, comma", "plain"] }] };
  it("escapes commas in csv", () => {
    const csv = comparisonToCsv(table);
    expect(csv).toContain('"has, comma"');
    expect(csv.split("\n")[0]).toBe("Criteria,A,B");
  });
  it("tsv uses tabs", () => {
    const tsv = comparisonToTsv(table);
    expect(tsv.split("\n")[0]).toBe("Criteria\tA\tB");
  });
});

describe("filenames", () => {
  it("builds clean dated filenames", () => {
    const name = exportFilename("meeting", "Jane Doe — first call", "pdf", new Date("2026-06-26T12:00:00Z"));
    expect(name).toMatch(/^harbor-meeting-prep-jane-doe-first-call-2026-06-26\.pdf$/);
  });
  it("slugify handles junk", () => {
    expect(slugify("  Hello, World!!! ")).toBe("hello-world");
  });
});

describe("evidence package", () => {
  it("includes claims, sources, excerpts, limitations; not full page content", () => {
    const pkg = buildEvidencePackage(artifact, "2026-06-26T00:00:00Z");
    expect(pkg.claims.length).toBe(1);
    expect(pkg.sources[0].excerpt).toBeTruthy();
    expect(pkg.limitations).toBeTruthy();
    expect((pkg.sources[0] as Record<string, unknown>).content).toBeUndefined();
  });
});

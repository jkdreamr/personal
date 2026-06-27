import { describe, it, expect } from "vitest";
import { enforceCitationRules } from "@/lib/research/citation-builder";
import { normalizeArtifact } from "@/lib/ai/task-runner";
import { modelArtifactSchema, claimSchema } from "@/lib/ai/schemas/artifact";
import type { Claim, Source } from "@/lib/types";

const sources: Source[] = [
  { id: "s1", title: "Acme About", trustTier: "primary", retrievedAt: "2026-06-26T00:00:00Z", excerpt: "Acme makes widgets." },
];

describe("verified-fact citation requirement", () => {
  it("downgrades a verified_fact with no real source", () => {
    const claims: Claim[] = [
      { id: "c1", text: "Acme is profitable", classification: "verified_fact", sourceIds: [], supportingExcerpts: [], confidence: "high" },
    ];
    const out = enforceCitationRules(claims, sources);
    expect(out[0].classification).toBe("not_sufficiently_supported");
  });
  it("downgrades a verified_fact citing a non-existent source id", () => {
    const claims: Claim[] = [
      { id: "c1", text: "x", classification: "verified_fact", sourceIds: ["ghost"], supportingExcerpts: ["q"], confidence: "high" },
    ];
    const out = enforceCitationRules(claims, sources);
    expect(out[0].classification).toBe("not_sufficiently_supported");
    expect(out[0].sourceIds).toEqual([]);
  });
  it("keeps a verified_fact with a real source + excerpt", () => {
    const claims: Claim[] = [
      { id: "c1", text: "Acme makes widgets", classification: "verified_fact", sourceIds: ["s1"], supportingExcerpts: ["Acme makes widgets."], confidence: "high" },
    ];
    const out = enforceCitationRules(claims, sources);
    expect(out[0].classification).toBe("verified_fact");
    expect(out[0].sourceIds).toEqual(["s1"]);
  });
});

describe("normalizeArtifact", () => {
  it("attaches service, ids claims, enforces citations, and orders sources by use", () => {
    const raw = modelArtifactSchema.parse({
      title: "Brief",
      sections: [{ heading: "Overview", body: "..." }],
      claims: [
        { text: "Unsupported fact", classification: "verified_fact", sourceIds: [], supportingExcerpts: [], confidence: "high" },
        { text: "Cited fact", classification: "verified_fact", sourceIds: ["s1"], supportingExcerpts: ["Acme makes widgets."], confidence: "high" },
      ],
    });
    const artifact = normalizeArtifact(raw, "brief", sources);
    expect(artifact.service).toBe("brief");
    expect(artifact.claims![0].id).toBeTruthy();
    expect(artifact.claims![0].classification).toBe("not_sufficiently_supported");
    expect(artifact.claims![1].classification).toBe("verified_fact");
    expect(artifact.demo).toBe(false);
  });
});

describe("claim schema classification", () => {
  it("accepts all five classifications", () => {
    for (const c of ["verified_fact", "reported_claim", "opinion", "unresolved_question", "not_sufficiently_supported"]) {
      const parsed = claimSchema.safeParse({ text: "x", classification: c, sourceIds: [], supportingExcerpts: [], confidence: "low" });
      expect(parsed.success).toBe(true);
    }
  });
  it("rejects an invalid classification", () => {
    expect(claimSchema.safeParse({ text: "x", classification: "definitely_true", confidence: "low" }).success).toBe(false);
  });
});

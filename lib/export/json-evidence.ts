import type { Artifact } from "@/lib/types";

/**
 * Evidence package JSON for research/challenge/verify/compare. Includes claims, their
 * classifications, source metadata, exact supporting excerpts, retrieval timestamps, open
 * questions, and limitations. Does NOT include full scraped page contents by default, nor
 * any prompts, model metadata, or internal instructions.
 */
export type EvidencePackage = {
  artifactTitle: string;
  artifactType: string;
  generatedAt: string;
  summary?: string;
  claims: {
    text: string;
    classification: string;
    confidence: string;
    sourceIds: string[];
    supportingExcerpts: string[];
  }[];
  sources: {
    id: string;
    title: string;
    publisher?: string;
    canonicalUrl?: string;
    trustTier: string;
    retrievedAt: string;
    publishedAt?: string;
    excerpt: string;
  }[];
  openQuestions: string[];
  limitations: string;
};

export function buildEvidencePackage(artifact: Artifact, generatedAt = new Date().toISOString()): EvidencePackage {
  return {
    artifactTitle: artifact.title,
    artifactType: artifact.service,
    generatedAt,
    summary: artifact.summary,
    claims: (artifact.claims ?? []).map((c) => ({
      text: c.text,
      classification: c.classification,
      confidence: c.confidence,
      sourceIds: c.sourceIds,
      supportingExcerpts: c.supportingExcerpts,
    })),
    sources: (artifact.sources ?? []).map((s) => ({
      id: s.id,
      title: s.title,
      publisher: s.publisher,
      canonicalUrl: s.canonicalUrl,
      trustTier: s.trustTier,
      retrievedAt: s.retrievedAt,
      publishedAt: s.publishedAt,
      excerpt: s.excerpt,
    })),
    openQuestions: artifact.openQuestions ?? [],
    limitations:
      artifact.coverageNote ??
      "This package reflects the sources provided and public pages Harbor could access. It is not a complete record of the internet.",
  };
}

export function evidencePackageToJson(artifact: Artifact): string {
  return JSON.stringify(buildEvidencePackage(artifact), null, 2);
}

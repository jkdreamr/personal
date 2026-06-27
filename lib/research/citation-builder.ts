import type { Claim, Source } from "@/lib/types";

/**
 * Helpers for the evidence contract. A verified_fact must reference at least one real
 * source id with a supporting excerpt; anything else is downgraded. Used both by the
 * task runner (post-processing model output) and by tests.
 */

export function enforceCitationRules(claims: Claim[], sources: Source[]): Claim[] {
  const ids = new Set(sources.map((s) => s.id));
  return claims.map((c) => {
    const validIds = c.sourceIds.filter((id) => ids.has(id));
    if (c.classification === "verified_fact" && (validIds.length === 0 || c.supportingExcerpts.length === 0)) {
      return { ...c, classification: "not_sufficiently_supported", sourceIds: validIds };
    }
    return { ...c, sourceIds: validIds };
  });
}

export const CLAIM_LABELS: Record<Claim["classification"], string> = {
  verified_fact: "Verified fact",
  reported_claim: "Reported claim",
  opinion: "Opinion",
  unresolved_question: "Unresolved question",
  not_sufficiently_supported: "Not sufficiently supported",
};

/** Coverage disclosure used across research-heavy services. */
export const COVERAGE_DISCLOSURE =
  "Harbor reviewed the sources you supplied and public pages it could access. This is not a complete record of the internet.";

import { CLAIM_LABELS } from "@/lib/research/citation-builder";
import { TRUST_TIER_LABELS } from "@/lib/research/trust-tier";
import type { Artifact } from "@/lib/types";

/**
 * Render an Artifact to clean Markdown. Preserves user edits when `editedBody` is supplied
 * (it replaces the generated sections). Never includes prompts, model metadata, or internals.
 */
export function artifactToMarkdown(artifact: Artifact, opts?: { editedBody?: string }): string {
  const out: string[] = [];
  out.push(`# ${artifact.title}`);
  if (artifact.demo) out.push(`> Demo example — built locally from your input, not a model.`);
  if (artifact.summary) out.push(`\n_${artifact.summary}_`);

  if (artifact.disclaimer) out.push(`\n> ${artifact.disclaimer}`);

  if (opts?.editedBody && opts.editedBody.trim()) {
    out.push("\n" + opts.editedBody.trim());
  } else {
    for (const s of artifact.sections) {
      out.push(`\n## ${s.heading}\n\n${s.body}`);
    }
  }

  if (artifact.email) {
    out.push(`\n## Email`);
    if (artifact.email.subjectOptions.length) {
      out.push(`\n**Subject options:**`);
      for (const subj of artifact.email.subjectOptions) out.push(`- ${subj}`);
    }
    out.push(`\n${artifact.email.body}`);
  }

  if (artifact.slides?.length) {
    out.push(`\n## Slides`);
    artifact.slides.forEach((sl, i) => {
      out.push(`\n### ${i + 1}. ${sl.title}  \n_${sl.layout}_`);
      if (sl.message) out.push(`\n${sl.message}`);
      for (const b of sl.bullets ?? []) out.push(`- ${b}`);
      if (sl.speakerNotes) out.push(`\n> Speaker notes: ${sl.speakerNotes}`);
    });
  }

  if (artifact.comparison) {
    out.push(`\n## Comparison\n`);
    out.push(`| Criteria | ${artifact.comparison.options.join(" | ")} |`);
    out.push(`| --- | ${artifact.comparison.options.map(() => "---").join(" | ")} |`);
    for (const row of artifact.comparison.criteria) {
      out.push(`| ${row.label} | ${row.values.map((v) => v.replace(/\|/g, "\\|")).join(" | ")} |`);
    }
  }

  if (artifact.assumptions?.length) {
    out.push(`\n## Assumptions Harbor made`);
    for (const a of artifact.assumptions) out.push(`- ${a}`);
  }

  if (artifact.claims?.length) {
    out.push(`\n## Claims and evidence`);
    for (const c of artifact.claims) {
      out.push(`\n- **[${CLAIM_LABELS[c.classification]}]** ${c.text} _(confidence: ${c.confidence})_`);
      for (const ex of c.supportingExcerpts) out.push(`  - "${ex}"`);
    }
  }

  if (artifact.openQuestions?.length) {
    out.push(`\n## Open questions`);
    for (const q of artifact.openQuestions) out.push(`- ${q}`);
  }

  if (artifact.nextActions?.length) {
    out.push(`\n## Next steps`);
    for (const a of artifact.nextActions) out.push(`- ${a}`);
  }

  if (artifact.sources?.length) {
    out.push(`\n## Sources and limitations`);
    artifact.sources.forEach((s) => {
      const bits = [s.title];
      if (s.publisher) bits.push(s.publisher);
      if (s.canonicalUrl) bits.push(s.canonicalUrl);
      out.push(`- ${bits.join(" — ")} (${TRUST_TIER_LABELS[s.trustTier]}, retrieved ${s.retrievedAt.slice(0, 10)})`);
    });
    if (artifact.coverageNote) out.push(`\n${artifact.coverageNote}`);
  } else if (artifact.coverageNote) {
    out.push(`\n_${artifact.coverageNote}_`);
  }

  return out.join("\n") + "\n";
}

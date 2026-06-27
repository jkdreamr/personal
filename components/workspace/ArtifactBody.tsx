"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { Info, Pencil, Check } from "lucide-react";
import type { Artifact } from "@/lib/types";
import { Badge } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { SafeMarkdown } from "./SafeMarkdown";
import { SlideDeck } from "./SlideDeck";
import { ComparisonView } from "./ComparisonView";
import type { RichDoc } from "@/lib/richdoc/types";
import { copyToClipboard } from "@/lib/client/download";

// The rich editor (Tiptap + KaTeX, ~270kB) loads only when a result is actually edited or rendered
// as a rich document — most results are viewed without it, so it stays out of the base bundle.
const Composer = dynamic(() => import("@/components/editor/Composer").then((m) => m.Composer), {
  ssr: false,
  loading: () => <div className="min-h-[340px] rounded-card border border-line bg-surface" aria-hidden />,
});
const RichDocumentRenderer = dynamic(() => import("@/components/editor/RichDocumentRenderer").then((m) => m.RichDocumentRenderer), {
  ssr: false,
  loading: () => <div className="min-h-[120px]" aria-hidden />,
});
import { useToast } from "@/components/ui/toast";
import { CLAIM_LABELS } from "@/lib/research/citation-builder";
import { TRUST_TIER_LABELS } from "@/lib/research/trust-tier";

export function sectionsToMarkdown(artifact: Artifact): string {
  return artifact.sections.map((s) => `## ${s.heading}\n\n${s.body}`).join("\n\n");
}

export function ArtifactBody({
  artifact,
  doc,
  editedBody,
  onDoc,
  editable,
  goal,
  context,
  editorActions = ["continue", "improve"],
}: {
  artifact: Artifact;
  doc?: RichDoc | null;
  editedBody?: string;
  /** Persist the canonical rich doc + its derived markdown. */
  onDoc: (doc: RichDoc, markdown: string) => void;
  editable: boolean;
  goal?: string;
  context?: string;
  editorActions?: ("continue" | "improve")[];
}) {
  const [editing, setEditing] = React.useState(false);
  const { toast } = useToast();
  const bodyMarkdown = editedBody && editedBody.trim() ? editedBody : sectionsToMarkdown(artifact);

  return (
    <article className="print-document">
      {artifact.demo && (
        <div className="mb-4 flex items-start gap-2 rounded-card border border-warning/30 bg-warning/[0.06] p-3 no-print">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <p className="text-sm text-ink/85">
            <span className="font-medium">Demo example.</span> Built locally from your input — no model or web access. Connect an
            OpenRouter key for full results.
          </p>
        </div>
      )}

      <header className="mb-4">
        <h1 className="font-display text-2xl font-semibold leading-tight text-ink">{artifact.title}</h1>
        {artifact.summary && <p className="mt-1.5 text-lead text-ink/75">{artifact.summary}</p>}
      </header>

      {artifact.disclaimer && (
        <p className="mb-4 rounded-card border border-line bg-surface/70 p-3 text-sm text-ink/80">{artifact.disclaimer}</p>
      )}

      {/* Editable body for writing-style services */}
      {editable && (
        <div className="mb-2 flex justify-end no-print">
          <Button variant="ghost" size="sm" onClick={() => setEditing((e) => !e)}>
            {editing ? <Check className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
            {editing ? "Done editing" : "Edit"}
          </Button>
        </div>
      )}

      {editing ? (
        <Composer
          doc={doc}
          initialMarkdown={bodyMarkdown}
          onDocChange={onDoc}
          goal={goal}
          context={context}
          actions={editorActions}
          minHeightClass="min-h-[340px]"
          placeholder="Edit freely — format with the toolbar, select text and Improve, or Continue from the end…"
        />
      ) : doc ? (
        <RichDocumentRenderer doc={doc} className="prose-harbor" />
      ) : (
        <SafeMarkdown text={bodyMarkdown} className="prose-harbor" />
      )}

      {artifact.email && artifact.email.body?.trim() && (
        <section className="mt-6 rounded-card border border-line bg-surface/50 p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lead font-semibold text-ink">Email</h2>
            <Badge tone="neutral">Ready to send</Badge>
          </div>
          {artifact.email.subjectOptions.length > 0 && (
            <div className="mt-3">
              <p className="text-meta text-muted">Subject options</p>
              <ul className="mt-1.5 space-y-1">
                {artifact.email.subjectOptions.map((s, i) => (
                  <li key={i} className="flex items-center justify-between gap-2 text-sm">
                    <span className="text-ink">{s}</span>
                    <button
                      aria-label="Copy this subject line"
                      onClick={async () => {
                        const ok = await copyToClipboard(s);
                        toast({ title: ok ? "Subject copied." : "Couldn't copy.", tone: ok ? "success" : "danger" });
                      }}
                      className="shrink-0 text-meta text-muted underline underline-offset-2 hover:text-ink no-print"
                    >
                      Copy
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="mt-3">
            <p className="text-meta text-muted">Body</p>
            <SafeMarkdown text={artifact.email.body} className="prose-harbor mt-1.5 whitespace-pre-wrap" />
          </div>
        </section>
      )}

      {artifact.slides && artifact.slides.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-3 text-lead font-semibold text-ink">Slides</h2>
          <SlideDeck slides={artifact.slides} />
        </section>
      )}

      {artifact.comparison && artifact.comparison.criteria?.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-3 text-lead font-semibold text-ink">Comparison</h2>
          <ComparisonView table={artifact.comparison} />
        </section>
      )}

      {artifact.coverageNote && !artifact.demo && (
        <p className="mt-6 border-t border-line pt-3 text-meta text-muted no-print">{artifact.coverageNote}</p>
      )}

      {/* Print-only appendix: side-panel evidence lives off-screen, so re-include it here
          to make the printed / saved-as-PDF document self-contained. */}
      <section className="print-only avoid-break" style={{ marginTop: "1.5rem" }}>
        {artifact.assumptions && artifact.assumptions.length > 0 && (
          <>
            <h2>Assumptions Harbor made</h2>
            <ul>{artifact.assumptions.map((a, i) => <li key={i}>{a}</li>)}</ul>
          </>
        )}
        {artifact.claims && artifact.claims.length > 0 && (
          <>
            <h2>Claims and evidence</h2>
            <ul>
              {artifact.claims.map((c) => (
                <li key={c.id}>
                  <strong>[{CLAIM_LABELS[c.classification]}]</strong> {c.text}
                  {c.supportingExcerpts[0] ? <> — “{c.supportingExcerpts[0]}”</> : null}
                </li>
              ))}
            </ul>
          </>
        )}
        {artifact.openQuestions && artifact.openQuestions.length > 0 && (
          <>
            <h2>Open questions</h2>
            <ul>{artifact.openQuestions.map((q, i) => <li key={i}>{q}</li>)}</ul>
          </>
        )}
        {artifact.nextActions && artifact.nextActions.length > 0 && (
          <>
            <h2>Next steps</h2>
            <ul>{artifact.nextActions.map((a, i) => <li key={i}>{a}</li>)}</ul>
          </>
        )}
        {artifact.sources && artifact.sources.length > 0 && (
          <>
            <h2>Sources and limitations</h2>
            <ul>
              {artifact.sources.map((s) => (
                <li key={s.id}>
                  {s.title}
                  {s.canonicalUrl ? ` — ${s.canonicalUrl}` : ""} ({TRUST_TIER_LABELS[s.trustTier]}, retrieved{" "}
                  {s.retrievedAt.slice(0, 10)})
                </li>
              ))}
            </ul>
            {artifact.coverageNote && <p>{artifact.coverageNote}</p>}
          </>
        )}
      </section>
    </article>
  );
}

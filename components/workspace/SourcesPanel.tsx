"use client";

import * as React from "react";
import { ExternalLink, HelpCircle, ListTodo } from "lucide-react";
import type { Artifact, Claim, Source } from "@/lib/types";
import { CLAIM_LABELS } from "@/lib/research/citation-builder";
import { TRUST_TIER_LABELS } from "@/lib/research/trust-tier";
import { Badge, Eyebrow } from "@/components/ui/primitives";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const CLAIM_TONE: Record<Claim["classification"], "success" | "info" | "neutral" | "warning" | "danger"> = {
  verified_fact: "success",
  reported_claim: "info",
  opinion: "neutral",
  unresolved_question: "warning",
  not_sufficiently_supported: "danger",
};

export function SourceChip({ source, onOpen }: { source: Source; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      className="inline-flex max-w-full items-center gap-1.5 rounded-chip border border-line bg-surface px-2 py-1 text-meta text-ink/80 hover:bg-ink/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/70"
    >
      <span className="truncate">{source.publisher || source.title}</span>
    </button>
  );
}

function SourceSheet({ source, open, onOpenChange }: { source: Source | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {source && (
          <div>
            <DialogTitle className="pr-6">{source.title}</DialogTitle>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge tone="primary">{TRUST_TIER_LABELS[source.trustTier]}</Badge>
              {source.publisher && <span className="text-meta text-muted">{source.publisher}</span>}
            </div>
            <dl className="mt-3 space-y-1.5 text-sm">
              {source.canonicalUrl && (
                <div className="flex items-start gap-2">
                  <dt className="w-20 shrink-0 text-muted">Link</dt>
                  <dd className="min-w-0 break-all">
                    <a
                      href={source.canonicalUrl}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="inline-flex items-center gap-1 text-ink underline underline-offset-2"
                    >
                      {source.canonicalUrl}
                      <ExternalLink className="h-3 w-3 shrink-0" />
                    </a>
                  </dd>
                </div>
              )}
              <div className="flex items-start gap-2">
                <dt className="w-20 shrink-0 text-muted">Retrieved</dt>
                <dd className="tnum">{new Date(source.retrievedAt).toLocaleString()}</dd>
              </div>
              {source.publishedAt && (
                <div className="flex items-start gap-2">
                  <dt className="w-20 shrink-0 text-muted">Published</dt>
                  <dd className="tnum">{source.publishedAt.slice(0, 10)}</dd>
                </div>
              )}
            </dl>
            {source.excerpt && (
              <div className="mt-3">
                <Eyebrow>Supporting excerpt</Eyebrow>
                <blockquote className="mt-1.5 border-l-2 border-line pl-3 text-sm text-ink/80">{source.excerpt}</blockquote>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function ClaimCard({ claim, sources, onOpenSource }: { claim: Claim; sources: Source[]; onOpenSource: (s: Source) => void }) {
  const cited = sources.filter((s) => claim.sourceIds.includes(s.id));
  return (
    <li className="rounded-card border border-line bg-canvas p-3">
      <div className="flex items-center gap-2">
        <Badge tone={CLAIM_TONE[claim.classification]}>{CLAIM_LABELS[claim.classification]}</Badge>
        <span className="text-meta text-muted">confidence: {claim.confidence}</span>
      </div>
      <p className="mt-2 text-sm text-ink">{claim.text}</p>
      {claim.supportingExcerpts.length > 0 && (
        <blockquote className="mt-2 border-l-2 border-line pl-2.5 text-meta text-ink/70">
          {claim.supportingExcerpts[0]}
        </blockquote>
      )}
      {cited.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {cited.map((s) => (
            <SourceChip key={s.id} source={s} onOpen={() => onOpenSource(s)} />
          ))}
        </div>
      )}
    </li>
  );
}

export function SourcesPanel({ artifact, coverage }: { artifact: Artifact | undefined; coverage?: string | null }) {
  const [openSource, setOpenSource] = React.useState<Source | null>(null);
  const [sheetOpen, setSheetOpen] = React.useState(false);

  const sources = artifact?.sources ?? [];
  const claims = artifact?.claims ?? [];
  const open = (s: Source) => {
    setOpenSource(s);
    setSheetOpen(true);
  };

  const hasAnything =
    sources.length > 0 ||
    claims.length > 0 ||
    (artifact?.openQuestions?.length ?? 0) > 0 ||
    (artifact?.nextActions?.length ?? 0) > 0;

  if (!hasAnything) {
    return (
      <div className="text-sm text-muted">
        Sources, claim checks, and next steps will appear here once Harbor has a result.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {claims.length > 0 && (
        <section>
          <Eyebrow>Claim checks</Eyebrow>
          <ul className="mt-2 space-y-2">
            {claims.map((c) => (
              <ClaimCard key={c.id} claim={c} sources={sources} onOpenSource={open} />
            ))}
          </ul>
        </section>
      )}

      {(artifact?.openQuestions?.length ?? 0) > 0 && (
        <section>
          <Eyebrow>
            <span className="inline-flex items-center gap-1.5">
              <HelpCircle className="h-3.5 w-3.5" /> Open questions
            </span>
          </Eyebrow>
          <ul className="mt-2 space-y-1.5 text-sm text-ink/85">
            {artifact!.openQuestions!.map((q, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-muted">·</span>
                <span>{q}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {(artifact?.nextActions?.length ?? 0) > 0 && (
        <section>
          <Eyebrow>
            <span className="inline-flex items-center gap-1.5">
              <ListTodo className="h-3.5 w-3.5" /> Next steps
            </span>
          </Eyebrow>
          <ul className="mt-2 space-y-1.5 text-sm text-ink/85">
            {artifact!.nextActions!.map((a, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-muted">·</span>
                <span>{a}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {sources.length > 0 && (
        <section>
          <Eyebrow>Sources</Eyebrow>
          <ul className="mt-2 space-y-1.5">
            {sources.map((s) => (
              <li key={s.id}>
                <button
                  onClick={() => open(s)}
                  className="group flex w-full items-start gap-2 rounded-btn px-1.5 py-1.5 text-left hover:bg-ink/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/70"
                >
                  <span className="mt-0.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-muted" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-ink">{s.title}</span>
                    <span className="block text-meta text-muted">{TRUST_TIER_LABELS[s.trustTier]}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {coverage && <p className="mt-3 text-meta text-muted">{coverage}</p>}
        </section>
      )}

      <SourceSheet source={openSource} open={sheetOpen} onOpenChange={setSheetOpen} />
    </div>
  );
}

export { CLAIM_TONE };

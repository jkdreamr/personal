"use client";

import * as React from "react";
import { Check, X, RefreshCw, Lightbulb } from "lucide-react";
import { Spinner } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";
import { GROUP_LABEL, GROUP_ORDER, groupForCategory, type Suggestion, type SuggestionGroup } from "@/lib/ai/suggest-schema";

export type ActiveSuggestion = Suggestion & { id: string; status: "active" | "stale"; from?: number; to?: number };

/**
 * The editorial suggestions panel — a focused list (not a modal). Every action is a real button, so
 * it works with keyboard and touch (no hover-only). Inline markers in the editor show where each
 * suggestion applies; this panel shows what it is and lets the user accept, dismiss, or refresh.
 */
export function SuggestPanel({
  loading,
  suggestions,
  overall,
  onAccept,
  onDismiss,
  onRefresh,
  onClose,
}: {
  loading: boolean;
  suggestions: ActiveSuggestion[];
  overall: string[];
  onAccept: (id: string) => void;
  onDismiss: (id: string) => void;
  onRefresh: () => void;
  onClose: () => void;
}) {
  const active = suggestions.filter((s) => s.status === "active");
  // Group by human "kind" so a reader sees the RANGE of what Suggest does at a glance.
  const grouped = GROUP_ORDER.map((g) => ({
    g,
    items: suggestions.filter((s) => groupForCategory(s.category) === g),
  })).filter((x) => x.items.length > 0);

  return (
    <section aria-label="Editorial suggestions" className="mt-4 rounded-card border border-line bg-canvas no-print">
      <header className="border-b border-line px-3.5 py-2.5">
        <div className="flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-muted" />
          <h2 className="text-sm font-medium text-ink">Suggestions</h2>
          {!loading && <span className="text-meta text-muted">{suggestions.length}</span>}
          <div className="ml-auto flex items-center gap-1">
            <button
              onClick={onRefresh}
              disabled={loading}
              aria-label="Refresh suggestions"
              className="inline-flex items-center gap-1 rounded-btn px-2 py-1 text-meta text-muted hover:bg-ink/[0.06] hover:text-ink disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/70"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} /> Refresh
            </button>
            <button
              onClick={onClose}
              aria-label="Close suggestions"
              className="rounded-btn p-1 text-muted hover:bg-ink/[0.06] hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/70"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        {/* Answer "what is this looking at?" up front. */}
        <p className="mt-1 text-meta text-muted">Based on your goal, anything you’ve added, and what you’ve written.</p>
      </header>

      {loading ? (
        <div className="flex items-start gap-2.5 px-3.5 py-5 text-sm text-ink/80">
          <Spinner />
          <span>
            Reading your draft against your goal and what you’ve added — checking wording, length, clarity, flow, and ideas to add.
          </span>
        </div>
      ) : (
        <div className="max-h-[42vh] overflow-y-auto px-3.5 py-3">
          {suggestions.length === 0 ? (
            <p className="py-2 text-sm text-muted">
              Nothing to change — this reads well. Suggest looks at wording, length, clarity, flow, and ideas to add; edit and
              refresh to check again.
            </p>
          ) : (
            <div className="space-y-3.5">
              {grouped.map(({ g, items }) => (
                <div key={g}>
                  <p className="mb-1.5 flex items-center gap-1.5 text-meta font-medium uppercase tracking-wide text-muted">
                    {GROUP_LABEL[g as SuggestionGroup]}
                    <span className="font-normal normal-case tracking-normal text-muted/80">{items.length}</span>
                  </p>
                  <ul className="space-y-2.5">
                    {items.map((s) => (
                      <li
                        key={s.id}
                        className={cn("rounded-card border border-line bg-surface/60 p-2.5", s.status === "stale" && "opacity-60")}
                      >
                        {s.status === "stale" && <p className="mb-1 text-meta text-warning">text changed — refresh</p>}
                        <p className="text-sm leading-relaxed">
                          <span className="text-ink/55 line-through decoration-ink/30">{s.target}</span>{" "}
                          {s.replacement.trim() ? (
                            <span className="font-medium text-ink">{s.replacement}</span>
                          ) : (
                            <span className="italic text-muted">(remove)</span>
                          )}
                        </p>
                        <p className="mt-1 text-meta text-muted">{s.rationale}</p>
                        <div className="mt-2 flex items-center gap-1.5">
                          <button
                            onClick={() => onAccept(s.id)}
                            disabled={s.status === "stale"}
                            className="inline-flex items-center gap-1 rounded-btn bg-ink px-2.5 py-1 text-meta font-medium text-canvas hover:bg-ink/90 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/70"
                          >
                            <Check className="h-3.5 w-3.5" /> Accept
                          </button>
                          <button
                            onClick={() => onDismiss(s.id)}
                            className="inline-flex items-center gap-1 rounded-btn border border-line px-2.5 py-1 text-meta font-medium text-ink/80 hover:bg-ink/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/70"
                          >
                            Dismiss
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}

          {overall.length > 0 && (
            <div className="mt-3.5 border-t border-line pt-3">
              <p className="text-meta font-medium uppercase tracking-wide text-muted">Overall direction</p>
              <ul className="mt-1.5 space-y-1">
                {overall.map((o, i) => (
                  <li key={i} className="flex gap-2 text-sm text-ink/85">
                    <span className="text-muted">·</span>
                    <span>{o}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
      <span className="sr-only" aria-live="polite">
        {loading ? "Analyzing draft" : `${active.length} active suggestions`}
      </span>
    </section>
  );
}

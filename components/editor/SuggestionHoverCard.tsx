"use client";

import * as React from "react";
import { Check } from "lucide-react";
import type { ActiveSuggestion } from "./SuggestPanel";

/**
 * A Grammarly-style hover card for an inline suggestion marker. It appears when the user hovers (or
 * focuses) an underlined target in the editor, anchored to that span, and offers Accept / Dismiss
 * right there. This is a convenience layer over the always-available Suggestions panel — the panel
 * remains the keyboard/touch-accessible path, so nothing here is hover-only-critical.
 */
export function SuggestionHoverCard({
  suggestion,
  rect,
  onAccept,
  onDismiss,
  onMouseEnter,
  onMouseLeave,
}: {
  suggestion: ActiveSuggestion;
  rect: DOMRect;
  onAccept: () => void;
  onDismiss: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}) {
  const WIDTH = 320;
  const margin = 10;
  const left = Math.min(Math.max(margin, rect.left), Math.max(margin, window.innerWidth - WIDTH - margin));
  // Prefer below the underline; flip above if there isn't room.
  const placeAbove = rect.bottom + 180 > window.innerHeight && rect.top > 180;
  const isAddition = suggestion.category === "addition";

  return (
    <div
      role="dialog"
      aria-label="Suggestion"
      data-suggestion-card
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
        position: "fixed",
        left,
        top: placeAbove ? rect.top - 8 : rect.bottom + 8,
        width: WIDTH,
        transform: placeAbove ? "translateY(-100%)" : undefined,
      }}
      className="z-[60] rounded-card border border-line bg-canvas p-3 shadow-lg"
    >
      <div className="flex items-center gap-2">
        <span className="rounded-chip border border-line bg-surface px-1.5 py-0.5 text-meta font-medium capitalize text-ink/80">
          {suggestion.category.replace("-", " ")}
        </span>
      </div>
      <p className="mt-1.5 text-sm leading-relaxed">
        {isAddition ? (
          <span className="font-medium text-ink">{suggestion.replacement}</span>
        ) : (
          <>
            <span className="text-ink/55 line-through decoration-ink/30">{suggestion.target}</span>{" "}
            {suggestion.replacement.trim() ? (
              <span className="font-medium text-ink">{suggestion.replacement}</span>
            ) : (
              <span className="italic text-muted">(remove)</span>
            )}
          </>
        )}
      </p>
      <p className="mt-1 text-meta text-muted">{suggestion.rationale}</p>
      <div className="mt-2 flex items-center gap-1.5">
        <button
          onClick={onAccept}
          className="inline-flex items-center gap-1 rounded-btn bg-ink px-2.5 py-1 text-meta font-medium text-canvas hover:bg-ink/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/70"
        >
          <Check className="h-3.5 w-3.5" /> Accept
        </button>
        <button
          onClick={onDismiss}
          className="inline-flex items-center gap-1 rounded-btn border border-line px-2.5 py-1 text-meta font-medium text-ink/80 hover:bg-ink/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/70"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

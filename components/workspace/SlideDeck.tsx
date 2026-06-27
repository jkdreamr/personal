"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, Play, X } from "lucide-react";
import type { Slide } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const LAYOUT_LABEL: Record<string, string> = {
  cover: "Cover",
  thesis: "Thesis",
  problem: "Problem",
  insight: "Insight",
  timeline: "Timeline",
  comparison: "Comparison",
  framework: "Framework",
  recommendation: "Recommendation",
  closing: "Closing",
};

/** One slide rendered editorially. Sparse, strong hierarchy, generous whitespace. */
function SlideCanvas({ slide, index, total, present }: { slide: Slide; index: number; total: number; present?: boolean }) {
  const big = slide.layout === "cover" || slide.layout === "closing" || slide.layout === "thesis";
  return (
    <div
      className={cn(
        "relative flex aspect-[16/9] w-full flex-col overflow-hidden border border-line bg-canvas",
        present ? "rounded-none border-0 p-[6vmin]" : "rounded-card p-8"
      )}
    >
      <div className="flex items-center justify-between">
        <span className={cn("text-meta uppercase tracking-wide text-muted", present && "text-[1.6vmin]")}>
          {LAYOUT_LABEL[slide.layout] ?? slide.layout}
        </span>
        <span className={cn("text-meta text-muted tnum", present && "text-[1.6vmin]")}>
          {index + 1} / {total}
        </span>
      </div>

      <div className={cn("flex flex-1 flex-col justify-center", big ? "gap-3" : "gap-4")}>
        {!big && (
          <h3 className={cn("font-display font-semibold text-ink", present ? "text-[3.4vmin]" : "text-xl")}>{slide.title}</h3>
        )}
        <p
          className={cn(
            "font-display text-ink",
            big ? (present ? "text-[6.5vmin] leading-[1.08]" : "text-3xl leading-tight") : present ? "text-[3vmin] leading-snug" : "text-lead",
            big && "font-semibold"
          )}
        >
          {slide.message || slide.title}
        </p>
        {slide.bullets && slide.bullets.length > 0 && (
          <ul className={cn("space-y-1.5 text-ink/85", present ? "text-[2.2vmin]" : "text-sm")}>
            {slide.bullets.map((b, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-muted">—</span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
        )}
        {slide.evidence && slide.evidence.length > 0 && (
          <p className={cn("text-muted", present ? "text-[1.8vmin]" : "text-meta")}>
            Evidence: {slide.evidence.join(" · ")}
          </p>
        )}
      </div>
    </div>
  );
}

export function SlideDeck({ slides }: { slides: Slide[] }) {
  const [presenting, setPresenting] = React.useState(false);
  const [idx, setIdx] = React.useState(0);

  const go = React.useCallback(
    (delta: number) => setIdx((i) => Math.min(slides.length - 1, Math.max(0, i + delta))),
    [slides.length]
  );

  React.useEffect(() => {
    if (!presenting) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") {
        e.preventDefault();
        go(1);
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        go(-1);
      } else if (e.key === "Escape") {
        setPresenting(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [presenting, go]);

  if (!slides.length) return null;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-muted">{slides.length} slides</p>
        <Button variant="secondary" size="sm" onClick={() => setPresenting(true)}>
          <Play className="h-4 w-4" /> Present
        </Button>
      </div>

      {/* Editorial preview list (also what prints). */}
      <div className="space-y-4 print-document">
        {slides.map((s, i) => (
          <div key={i} className="avoid-break space-y-2">
            <SlideCanvas slide={s} index={i} total={slides.length} />
            {s.speakerNotes && (
              <p className="px-1 text-sm text-ink/70">
                <span className="font-medium text-ink">Notes:</span> {s.speakerNotes}
              </p>
            )}
          </div>
        ))}
      </div>

      {presenting && (
        <div className="fixed inset-0 z-[120] flex flex-col bg-ink/95">
          <div className="flex items-center justify-between px-4 py-2 text-canvas/80">
            <span className="text-meta tnum">
              {idx + 1} / {slides.length}
            </span>
            <button onClick={() => setPresenting(false)} aria-label="Exit presentation" className="rounded p-1.5 hover:bg-canvas/10">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="flex flex-1 items-center justify-center px-4 pb-8">
            <div className="w-full max-w-[1100px]">
              <SlideCanvas slide={slides[idx]} index={idx} total={slides.length} present />
            </div>
          </div>
          <div className="flex items-center justify-center gap-3 pb-6">
            <Button variant="secondary" size="sm" onClick={() => go(-1)} disabled={idx === 0}>
              <ChevronLeft className="h-4 w-4" /> Back
            </Button>
            <Button variant="secondary" size="sm" onClick={() => go(1)} disabled={idx === slides.length - 1}>
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

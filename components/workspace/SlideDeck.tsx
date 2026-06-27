"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, Play, MonitorPlay, X, Plus, Copy, Trash2, ArrowUp, ArrowDown, Undo2 } from "lucide-react";
import type { Slide } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const LAYOUTS = [
  "cover",
  "thesis",
  "problem",
  "insight",
  "timeline",
  "comparison",
  "framework",
  "recommendation",
  "closing",
] as const;

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

const SLIDE_FONT: React.CSSProperties = { fontFamily: "var(--font-sans)" };

/** One slide rendered editorially. Sparse, strong hierarchy, generous whitespace. Clips overflow. */
function SlideCanvas({ slide, index, total, present }: { slide: Slide; index: number; total: number; present?: boolean }) {
  const big = slide.layout === "cover" || slide.layout === "closing" || slide.layout === "thesis";
  return (
    <div
      style={SLIDE_FONT}
      className={cn(
        "relative flex aspect-[16/9] w-full flex-col overflow-hidden border border-line bg-canvas",
        present ? "rounded-none border-0 p-[6vmin]" : "rounded-card p-8"
      )}
    >
      <div className="flex items-center justify-between">
        <span className={cn("text-meta text-muted", present && "text-[1.6vmin]")}>{LAYOUT_LABEL[slide.layout] ?? slide.layout}</span>
        <span className={cn("text-meta text-muted tnum", present && "text-[1.6vmin]")}>
          {index + 1} / {total}
        </span>
      </div>

      <div className={cn("flex flex-1 flex-col justify-center overflow-hidden", big ? "gap-3" : "gap-4")}>
        {!big && slide.title && (
          <h3 className={cn("font-semibold text-ink", present ? "text-[3.4vmin]" : "text-xl")}>{slide.title}</h3>
        )}
        <p
          className={cn(
            "text-ink",
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
          <p className={cn("text-muted", present ? "text-[1.8vmin]" : "text-meta")}>Evidence: {slide.evidence.join(" · ")}</p>
        )}
      </div>
    </div>
  );
}

/** Seconds → m:ss for the presenter clock. */
function mmss(total: number): string {
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

function cloneSlides(slides: Slide[]): Slide[] {
  return slides.map((s) => ({ ...s, bullets: s.bullets ? [...s.bullets] : undefined, evidence: s.evidence ? [...s.evidence] : undefined }));
}

const inputClass =
  "w-full rounded-btn border border-line bg-surface px-2.5 py-1.5 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/70";

export function SlideDeck({ slides, onChange }: { slides: Slide[]; onChange?: (slides: Slide[]) => void }) {
  const editable = Boolean(onChange);
  const [presenting, setPresenting] = React.useState(false);
  const [presenter, setPresenter] = React.useState(false); // presenter view (notes + next) vs. clean audience view
  const [elapsed, setElapsed] = React.useState(0); // seconds since the presentation started
  const [idx, setIdx] = React.useState(0);
  const history = React.useRef<Slide[][]>([]);
  const [canUndo, setCanUndo] = React.useState(false);

  // Run an elapsed-time clock while presenting; reset whenever a presentation starts.
  React.useEffect(() => {
    if (!presenting) return;
    setElapsed(0);
    const t = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [presenting]);

  const startPresenting = (asPresenter: boolean) => {
    setPresenter(asPresenter);
    setPresenting(true);
  };

  // Keep the selection valid as the deck changes.
  React.useEffect(() => {
    setIdx((i) => Math.min(Math.max(0, i), Math.max(0, slides.length - 1)));
  }, [slides.length]);

  const go = React.useCallback((delta: number) => setIdx((i) => Math.min(slides.length - 1, Math.max(0, i + delta))), [slides.length]);

  const pushHistory = React.useCallback(() => {
    const snap = cloneSlides(slides);
    const last = history.current[history.current.length - 1];
    if (last && JSON.stringify(last) === JSON.stringify(snap)) return; // dedupe no-op snapshots
    history.current.push(snap);
    if (history.current.length > 40) history.current.shift();
    setCanUndo(true);
  }, [slides]);

  const undo = React.useCallback(() => {
    const prev = history.current.pop();
    if (prev) {
      onChange?.(prev);
      setCanUndo(history.current.length > 0);
    }
  }, [onChange]);

  const commit = (next: Slide[]) => onChange?.(next);

  const updateSlide = (i: number, patch: Partial<Slide>) => {
    const next = cloneSlides(slides);
    next[i] = { ...next[i], ...patch };
    commit(next);
  };

  const addSlide = () => {
    pushHistory();
    const next = cloneSlides(slides);
    const at = Math.min(idx + 1, next.length);
    next.splice(at, 0, { layout: "insight", title: "New slide", message: "", bullets: [] });
    commit(next);
    setIdx(at);
  };
  const duplicateSlide = () => {
    pushHistory();
    const next = cloneSlides(slides);
    next.splice(idx + 1, 0, cloneSlides([slides[idx]])[0]);
    commit(next);
    setIdx(idx + 1);
  };
  const deleteSlide = () => {
    if (slides.length <= 1) return;
    pushHistory();
    const next = cloneSlides(slides);
    next.splice(idx, 1);
    commit(next);
    setIdx(Math.max(0, idx - 1));
  };
  const moveSlide = (dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= slides.length) return;
    pushHistory();
    const next = cloneSlides(slides);
    [next[idx], next[j]] = [next[j], next[idx]];
    commit(next);
    setIdx(j);
  };

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
  const current = slides[Math.min(idx, slides.length - 1)];

  return (
    <div>
      {/* toolbar */}
      <div className="mb-3 flex flex-wrap items-center gap-1.5 no-print">
        <Button variant="secondary" size="sm" onClick={() => startPresenting(false)}>
          <Play className="h-4 w-4" /> Present
        </Button>
        <Button variant="ghost" size="sm" onClick={() => startPresenting(true)}>
          <MonitorPlay className="h-4 w-4" /> Presenter view
        </Button>
        {editable && (
          <>
            <span aria-hidden className="mx-1 h-5 w-px bg-line" />
            <DeckBtn icon={Plus} label="Add slide" onClick={addSlide} />
            <DeckBtn icon={Copy} label="Duplicate slide" onClick={duplicateSlide} />
            <DeckBtn icon={Trash2} label="Delete slide" onClick={deleteSlide} disabled={slides.length <= 1} />
            <DeckBtn icon={ArrowUp} label="Move slide up" onClick={() => moveSlide(-1)} disabled={idx === 0} />
            <DeckBtn icon={ArrowDown} label="Move slide down" onClick={() => moveSlide(1)} disabled={idx === slides.length - 1} />
            <DeckBtn icon={Undo2} label="Undo" onClick={undo} disabled={!canUndo} />
          </>
        )}
        <span className="ml-auto text-meta text-muted tnum">{slides.length} slides</span>
      </div>

      {/* navigator + editor */}
      <div className="grid gap-4 no-print md:grid-cols-[180px_minmax(0,1fr)]">
        <nav aria-label="Slides" className="flex gap-2 overflow-x-auto md:max-h-[60vh] md:flex-col md:overflow-y-auto">
          {slides.map((s, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              aria-current={i === idx ? "true" : undefined}
              aria-label={`Slide ${i + 1}: ${s.title || LAYOUT_LABEL[s.layout]}`}
              className={cn(
                "flex shrink-0 items-stretch gap-2 rounded-btn border p-1.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/70 md:w-full",
                i === idx ? "border-ink/40 bg-ink/[0.06]" : "border-line hover:bg-ink/[0.04]"
              )}
            >
              <span className="mt-0.5 w-4 shrink-0 text-meta text-muted tnum">{i + 1}</span>
              <span style={SLIDE_FONT} className="flex aspect-[16/9] w-20 shrink-0 flex-col justify-center overflow-hidden rounded border border-line bg-canvas px-1.5 py-1 md:w-full">
                <span className="line-clamp-3 text-[8px] font-semibold leading-tight text-ink">{s.message || s.title || LAYOUT_LABEL[s.layout]}</span>
              </span>
            </button>
          ))}
        </nav>

        <div className="min-w-0">
          <SlideCanvas slide={current} index={idx} total={slides.length} />
          {editable && (
            <div className="mt-3 space-y-2.5 rounded-card border border-line bg-canvas p-3">
              <div className="flex items-center gap-2">
                <label htmlFor="slide-layout" className="text-meta text-muted">
                  Layout
                </label>
                <select
                  id="slide-layout"
                  value={current.layout}
                  onFocus={pushHistory}
                  onChange={(e) => updateSlide(idx, { layout: e.target.value as Slide["layout"] })}
                  className="rounded-btn border border-line bg-surface px-2 py-1 text-meta text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/70"
                >
                  {LAYOUTS.map((l) => (
                    <option key={l} value={l}>
                      {LAYOUT_LABEL[l]}
                    </option>
                  ))}
                </select>
              </div>
              <input
                aria-label="Slide title"
                className={inputClass}
                placeholder="Slide title"
                value={current.title}
                onFocus={pushHistory}
                onChange={(e) => updateSlide(idx, { title: e.target.value })}
              />
              <textarea
                aria-label="Main message"
                className={cn(inputClass, "min-h-[60px] resize-y")}
                placeholder="The single main message of this slide"
                value={current.message}
                onFocus={pushHistory}
                onChange={(e) => updateSlide(idx, { message: e.target.value })}
              />
              <div>
                <p className="mb-1 text-meta text-muted">Bullets</p>
                <ul className="space-y-1.5">
                  {(current.bullets ?? []).map((b, bi) => (
                    <li key={bi} className="flex items-center gap-1.5">
                      <input
                        aria-label={`Bullet ${bi + 1}`}
                        className={inputClass}
                        value={b}
                        onFocus={pushHistory}
                        onChange={(e) => {
                          const bullets = [...(current.bullets ?? [])];
                          bullets[bi] = e.target.value;
                          updateSlide(idx, { bullets });
                        }}
                      />
                      <button
                        aria-label={`Remove bullet ${bi + 1}`}
                        onClick={() => {
                          pushHistory();
                          updateSlide(idx, { bullets: (current.bullets ?? []).filter((_, k) => k !== bi) });
                        }}
                        className="shrink-0 rounded-btn p-1.5 text-muted hover:bg-ink/[0.06] hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/70"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => {
                    pushHistory();
                    updateSlide(idx, { bullets: [...(current.bullets ?? []), ""] });
                  }}
                  className="mt-1.5 inline-flex items-center gap-1 text-meta text-muted underline underline-offset-2 hover:text-ink"
                >
                  <Plus className="h-3.5 w-3.5" /> Add bullet
                </button>
              </div>
              <div>
                <label htmlFor="slide-notes" className="text-meta text-muted">
                  Speaker notes
                </label>
                <textarea
                  id="slide-notes"
                  className={cn(inputClass, "mt-1 min-h-[52px] resize-y")}
                  placeholder="Notes for you while presenting (printed, never shown on the slide)"
                  value={current.speakerNotes ?? ""}
                  onFocus={pushHistory}
                  onChange={(e) => updateSlide(idx, { speakerNotes: e.target.value })}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* print: the whole deck + notes. No `print-document` here — it renders inside ArtifactBody's
          print-document article; a nested one would inherit the print absolute-positioning. */}
      <div className="hidden print:block">
        {slides.map((s, i) => (
          <div key={i} className="avoid-break space-y-2" style={{ marginBottom: "1.5rem" }}>
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
        <div className="fixed inset-0 z-[120] flex flex-col bg-ink/95 text-canvas">
          <div className="flex items-center justify-between gap-3 px-4 py-2 text-canvas/80">
            <span className="flex items-center gap-2.5 text-meta tnum">
              <span aria-label="Elapsed time">{mmss(elapsed)}</span>
              <span aria-hidden className="text-canvas/40">·</span>
              <span aria-label="Slide position">
                {idx + 1} / {slides.length}
              </span>
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPresenter((p) => !p)}
                className="rounded px-2 py-1 text-meta font-medium hover:bg-canvas/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-canvas/40"
              >
                {presenter ? "Audience view" : "Presenter view"}
              </button>
              <button onClick={() => setPresenting(false)} aria-label="Exit presentation" className="rounded p-1.5 hover:bg-canvas/10">
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {presenter ? (
            <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 px-4 pb-3 md:grid-cols-[1.65fr_1fr]">
              <div className="flex min-w-0 flex-col justify-center">
                <p className="mb-1.5 text-meta uppercase tracking-wide text-canvas/50">Current</p>
                <div className="overflow-hidden rounded-card">
                  <SlideCanvas slide={current} index={idx} total={slides.length} />
                </div>
              </div>
              <div className="flex min-h-0 flex-col gap-3">
                <div>
                  <p className="mb-1.5 text-meta uppercase tracking-wide text-canvas/50">Next</p>
                  {slides[idx + 1] ? (
                    <div className="overflow-hidden rounded-card opacity-90">
                      <SlideCanvas slide={slides[idx + 1]} index={idx + 1} total={slides.length} />
                    </div>
                  ) : (
                    <div className="flex aspect-[16/9] items-center justify-center rounded-card border border-canvas/20 text-sm text-canvas/50">
                      End of deck
                    </div>
                  )}
                </div>
                <div
                  role="region"
                  aria-label="Speaker notes"
                  className="min-h-0 flex-1 overflow-y-auto rounded-card border border-canvas/15 bg-canvas/[0.04] p-3"
                >
                  <p className="mb-1 text-meta uppercase tracking-wide text-canvas/50">Speaker notes</p>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-canvas/90">
                    {current.speakerNotes?.trim() || "No notes for this slide."}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center px-4 pb-8">
              <div className="w-full max-w-[1100px]">
                <SlideCanvas slide={current} index={idx} total={slides.length} present />
              </div>
            </div>
          )}

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

function DeckBtn({ icon: Icon, label, onClick, disabled }: { icon: React.ComponentType<{ className?: string }>; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="inline-flex h-9 w-9 items-center justify-center rounded-btn text-ink/80 hover:bg-ink/[0.07] disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/70"
    >
      <Icon className="h-[18px] w-[18px]" />
    </button>
  );
}

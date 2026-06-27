"use client";

import * as React from "react";
import { Sparkles, ArrowDown, Wand2, StopCircle, ChevronDown } from "lucide-react";
import { streamCompose, fetchGhost } from "@/lib/client/compose";
import { lintText, type StyleWarning } from "@/lib/editorial/style-lint";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/primitives";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/overlays";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

export type ComposerAction = "write" | "continue" | "improve";

/** Improvement presets for "Improve selection" — the user picks the kind of change. */
const IMPROVE_OPTIONS: { label: string; instruction: string }[] = [
  { label: "Make it shorter", instruction: "Make this shorter and tighter without losing meaning." },
  { label: "Make it longer", instruction: "Expand this with more useful detail and specifics; keep it on point." },
  { label: "Make it clearer", instruction: "Make this clearer and more direct; simplify any awkward phrasing." },
  { label: "Sound more human", instruction: "Rewrite this so it sounds natural and human — less stiff, less generic, like a real person wrote it. Keep the meaning and facts." },
  { label: "More formal", instruction: "Make this more formal and professional." },
  { label: "Warmer / more casual", instruction: "Make this warmer and more conversational, while staying professional." },
];

/**
 * A reusable cursor-style editor: inline ghost-text autocomplete (light grey, Tab to accept,
 * Esc to dismiss), live local editorial hints, and streaming Write / Continue / Improve actions.
 * Controlled by the parent. Used by the Write studio AND every tool's "Edit" mode, so editing
 * works identically everywhere. Fully testable in demo mode (compose/ghost stream locally).
 */
export function Composer({
  value,
  onChange,
  goal,
  context,
  tone,
  length,
  actions = ["continue", "improve"],
  placeholder = "Start writing, or use the actions above…",
  minHeightClass = "min-h-[280px]",
  editorClassName,
  autoRun,
  onStreamingChange,
}: {
  value: string;
  onChange: (v: string) => void;
  goal?: string;
  context?: string;
  tone?: string;
  length?: string;
  actions?: ComposerAction[];
  placeholder?: string;
  minHeightClass?: string;
  editorClassName?: string;
  autoRun?: "write";
  onStreamingChange?: (streaming: boolean) => void;
}) {
  const { toast } = useToast();
  const [ghost, setGhost] = React.useState("");
  const [hints, setHints] = React.useState<StyleWarning[]>([]);
  const [streaming, setStreaming] = React.useState(false);
  const [improveOpen, setImproveOpen] = React.useState(false);

  const taRef = React.useRef<HTMLTextAreaElement>(null);
  const overlayRef = React.useRef<HTMLDivElement>(null);
  const streamCtl = React.useRef<AbortController | null>(null);
  const ghostCtl = React.useRef<AbortController | null>(null);
  const ghostTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const hintTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoRan = React.useRef(false);
  const valueRef = React.useRef(value);
  valueRef.current = value;
  // Mirrors of state read inside the heartbeat interval (avoids stale closures / re-arming it).
  const ghostRef = React.useRef("");
  const streamingRef = React.useRef(false);
  React.useEffect(() => {
    ghostRef.current = ghost;
  }, [ghost]);

  const setStreamingState = (b: boolean) => {
    setStreaming(b);
    streamingRef.current = b;
    onStreamingChange?.(b);
  };

  React.useEffect(() => {
    setHints(lintText(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clearGhost = React.useCallback(() => {
    setGhost("");
    ghostCtl.current?.abort();
    if (ghostTimer.current) clearTimeout(ghostTimer.current);
  }, []);

  const scheduleHints = (val: string) => {
    if (hintTimer.current) clearTimeout(hintTimer.current);
    hintTimer.current = setTimeout(() => setHints(lintText(val)), 400);
  };

  // Fetch a suggestion for the END of `val` (caret must be at the end). Shared by the quick
  // pause-trigger and the periodic heartbeat below. No-ops while streaming or when text is too short.
  const requestGhost = React.useCallback(
    async (val: string) => {
      const ta = taRef.current;
      // Only when the editor is focused and the caret sits at the very end (don't surface a ghost
      // in an editor the user has clicked away from, or mid-text).
      if (!ta || (typeof document !== "undefined" && document.activeElement !== ta)) return;
      const caretAtEnd = ta.selectionStart === val.length && ta.selectionEnd === val.length;
      if (!caretAtEnd || streamingRef.current || val.trim().length < 10) return;
      ghostCtl.current?.abort();
      const ctl = new AbortController();
      ghostCtl.current = ctl;
      const para = val.slice(val.lastIndexOf("\n\n") + 1);
      const s = await fetchGhost(para, goal, ctl.signal);
      if (!ctl.signal.aborted && valueRef.current === val && s) {
        setGhost(s.startsWith(" ") || /[\s([]$/.test(val) ? s : " " + s);
      }
    },
    [goal]
  );

  // Quick path: a short pause (850ms) after typing shows a suggestion immediately.
  const scheduleGhost = (val: string, caretAtEnd: boolean) => {
    if (ghostTimer.current) clearTimeout(ghostTimer.current);
    ghostCtl.current?.abort();
    setGhost("");
    if (!caretAtEnd || streaming || val.trim().length < 10) return;
    ghostTimer.current = setTimeout(() => requestGhost(val), 850);
  };

  // Heartbeat: even while writing continuously, surface a fresh suggestion roughly every 10s so the
  // editor proactively offers a "Tab to accept" continuation (cursor-style). Only when one isn't
  // already showing and the caret sits at the end of the text.
  React.useEffect(() => {
    const id = setInterval(() => {
      if (!ghostRef.current && !streamingRef.current) requestGhost(valueRef.current);
    }, 10_000);
    return () => clearInterval(id);
  }, [requestGhost]);

  const handleChange = (val: string) => {
    onChange(val);
    scheduleHints(val);
    const ta = taRef.current;
    const caretAtEnd = ta ? ta.selectionStart === val.length && ta.selectionEnd === val.length : false;
    scheduleGhost(val, caretAtEnd);
  };

  const acceptGhost = () => {
    if (!ghost) return;
    const next = value + ghost;
    setGhost("");
    onChange(next);
    scheduleHints(next);
    requestAnimationFrame(() => {
      const ta = taRef.current;
      if (ta) {
        ta.focus();
        ta.setSelectionRange(next.length, next.length);
      }
    });
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (ghost && e.key === "Tab") {
      e.preventDefault();
      acceptGhost();
      return;
    }
    if (ghost && e.key === "Escape") {
      e.preventDefault();
      clearGhost();
      return;
    }
    if (ghost) clearGhost();
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && actions.includes("continue")) {
      e.preventDefault();
      run("continue");
    }
  };

  const onScroll = () => {
    if (overlayRef.current && taRef.current) overlayRef.current.scrollTop = taRef.current.scrollTop;
  };

  const run = (mode: ComposerAction, instruction?: string) => {
    if (streaming) return;
    clearGhost();
    const ta = taRef.current;
    const base = value;
    let selStart = base.length;
    let selEnd = base.length;
    let selection = "";
    if (mode === "improve") {
      if (!ta) return;
      selStart = ta.selectionStart;
      selEnd = ta.selectionEnd;
      selection = base.slice(selStart, selEnd);
      if (!selection.trim()) {
        toast({ title: "Select the text you want to improve first." });
        return;
      }
    }
    const replaceAll = mode === "write" && base.trim().length === 0;

    setStreamingState(true);
    let acc = "";
    streamCtl.current = streamCompose(
      { mode, goal, context, currentText: base, selection, instruction, tone: tone || undefined, length: length || undefined },
      {
        onDelta: (d) => {
          acc += d;
          if (mode === "improve") onChange(base.slice(0, selStart) + acc + base.slice(selEnd));
          else if (replaceAll) onChange(acc);
          else {
            const sep = !base || base.endsWith("\n") || mode === "continue" ? "" : "\n\n";
            onChange(base + sep + acc);
          }
        },
        onDone: () => {
          setStreamingState(false);
          scheduleHints(valueRef.current);
        },
        onError: (m) => {
          setStreamingState(false);
          toast({ title: m, tone: "danger" });
        },
      }
    );
  };

  const stop = () => {
    streamCtl.current?.abort();
    setStreamingState(false);
  };

  // Auto-run once (e.g. arriving from the home intake with a goal and an empty editor).
  React.useEffect(() => {
    if (autoRun === "write" && !autoRan.current && goal?.trim() && !value.trim() && !streaming) {
      autoRan.current = true;
      run("write");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRun, goal]);

  React.useEffect(() => {
    return () => {
      streamCtl.current?.abort();
      ghostCtl.current?.abort();
      [ghostTimer, hintTimer].forEach((t) => t.current && clearTimeout(t.current));
    };
  }, []);

  const wordCount = value.trim() ? value.trim().split(/\s+/).length : 0;
  const writeLabel = value.trim() ? "Rewrite" : "Write it for me";

  return (
    <div>
      {/* action bar */}
      <div className="mb-2 flex flex-wrap items-center gap-2 no-print">
        {actions.includes("write") && (
          <Button size="sm" onClick={() => run("write")} disabled={streaming}>
            <Sparkles className="h-4 w-4" /> {writeLabel}
          </Button>
        )}
        {actions.includes("continue") && (
          <Button size="sm" variant="secondary" onClick={() => run("continue")} disabled={streaming || !value.trim()}>
            <ArrowDown className="h-4 w-4" /> Continue
          </Button>
        )}
        {actions.includes("improve") && (
          <Popover open={improveOpen} onOpenChange={setImproveOpen}>
            <PopoverTrigger asChild>
              <Button size="sm" variant="secondary" disabled={streaming}>
                <Wand2 className="h-4 w-4" /> Improve selection <ChevronDown className="h-3.5 w-3.5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-56">
              <p className="px-2 pb-1 text-meta text-muted">Improve the selected text…</p>
              {IMPROVE_OPTIONS.map((opt) => (
                <button
                  key={opt.label}
                  onClick={() => {
                    setImproveOpen(false);
                    run("improve", opt.instruction);
                  }}
                  className="flex w-full items-center rounded-btn px-2.5 py-2 text-left text-sm text-ink hover:bg-ink/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/70"
                >
                  {opt.label}
                </button>
              ))}
            </PopoverContent>
          </Popover>
        )}
        {streaming && (
          <button onClick={stop} className="inline-flex items-center gap-1 text-meta text-muted underline underline-offset-2 hover:text-ink">
            <StopCircle className="h-3.5 w-3.5" /> Stop
          </button>
        )}
      </div>

      {/* editor with inline ghost overlay (light grey autocomplete) */}
      <div className={cn("relative rounded-card border border-line bg-surface", minHeightClass, editorClassName)}>
        <div
          ref={overlayRef}
          aria-hidden
          className="pointer-events-none absolute inset-0 overflow-auto whitespace-pre-wrap break-words px-3.5 py-3 font-sans text-base leading-relaxed text-transparent"
        >
          {value}
          {/* Explicit colour (not a Tailwind opacity class) so it overrides the overlay's
              transparent text — this is the visible light-grey inline autocomplete. */}
          {ghost && <span style={{ color: "var(--harbor-muted-soft)" }}>{ghost}</span>}
        </div>
        <textarea
          ref={taRef}
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={onKeyDown}
          onScroll={onScroll}
          onSelect={() => ghost && clearGhost()}
          onBlur={clearGhost}
          disabled={streaming}
          spellCheck
          placeholder={placeholder}
          className="absolute inset-0 h-full w-full resize-none bg-transparent px-3.5 py-3 font-sans text-base leading-relaxed text-ink caret-ink placeholder:text-muted focus-visible:outline-none"
        />
      </div>

      {/* status / hints */}
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 no-print">
        {streaming ? (
          <span className="inline-flex items-center gap-2 text-sm text-ink/80">
            <Spinner /> Writing…
          </span>
        ) : (
          <>
            <span className="text-meta text-muted tnum">{wordCount} words</span>
            {hints.length > 0 && (
              <Popover>
                <PopoverTrigger asChild>
                  <button className="inline-flex items-center gap-1.5 rounded-chip border border-warning/30 bg-warning/[0.06] px-2 py-0.5 text-meta font-medium text-warning hover:bg-warning/10">
                    {hints.length} suggestion{hints.length === 1 ? "" : "s"}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-80">
                  <p className="px-1 pb-1 text-meta font-medium text-muted">Editorial hints — yours to take or leave</p>
                  <ul className="space-y-1">
                    {hints.slice(0, 8).map((h, i) => (
                      <li key={i} className="rounded-btn px-2 py-1.5 text-sm text-ink/85 hover:bg-ink/[0.04]">{h.message}</li>
                    ))}
                  </ul>
                </PopoverContent>
              </Popover>
            )}
            {ghost ? (
              <span className="text-meta text-muted">suggestion ready — press Tab to accept</span>
            ) : (
              value.trim().length >= 10 && <span className="text-meta text-muted">suggestions appear as you write · Tab to accept</span>
            )}
          </>
        )}
      </div>
    </div>
  );
}

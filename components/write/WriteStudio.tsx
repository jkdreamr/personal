"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Sparkles, ArrowDown, Wand2, Copy, Download, Printer, Cloud, StopCircle, CornerDownLeft } from "lucide-react";
import type { Attachment, Task } from "@/lib/types";
import { getTask, newTask, saveTask } from "@/lib/db/tasks";
import { streamCompose, fetchGhost } from "@/lib/client/compose";
import { lintText, type StyleWarning } from "@/lib/editorial/style-lint";
import { downloadText, copyToClipboard } from "@/lib/client/download";
import { exportFilename } from "@/lib/export/filename";
import { relativeTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea, Label, Input } from "@/components/ui/field";
import { Spinner, Badge, Eyebrow } from "@/components/ui/primitives";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/overlays";
import { AttachmentAdder } from "@/components/workspace/AttachmentAdder";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

const TONES = ["", "Direct", "Professional", "Warm", "Formal"];
const LENGTHS = ["", "Short", "Balanced", "Thorough"];

function Suspended({ children }: { children: React.ReactNode }) {
  return <React.Suspense fallback={null}>{children}</React.Suspense>;
}

export function WriteStudio() {
  return (
    <Suspended>
      <Studio />
    </Suspended>
  );
}

function Studio() {
  const router = useRouter();
  const sp = useSearchParams();
  const taskId = sp.get("task") ?? undefined;
  const autorun = sp.get("run") === "1";
  const { toast } = useToast();
  const started = React.useRef(false);

  const [task, setTask] = React.useState<Task | null>(null);
  const [goal, setGoal] = React.useState("");
  const [attachments, setAttachments] = React.useState<Attachment[]>([]);
  const [text, setText] = React.useState("");
  const [ghost, setGhost] = React.useState("");
  const [tone, setTone] = React.useState("");
  const [length, setLength] = React.useState("");
  const [streaming, setStreaming] = React.useState(false);
  const [savedAt, setSavedAt] = React.useState<string | null>(null);
  const [hints, setHints] = React.useState<StyleWarning[]>([]);

  const taRef = React.useRef<HTMLTextAreaElement>(null);
  const overlayRef = React.useRef<HTMLDivElement>(null);
  const streamCtl = React.useRef<AbortController | null>(null);
  const ghostCtl = React.useRef<AbortController | null>(null);
  const ghostTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const hintTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const textRef = React.useRef(text);
  textRef.current = text;

  // ---- load / create the task ----
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const existing = taskId ? await getTask(taskId) : undefined;
      if (cancelled) return;
      if (existing) {
        setTask(existing);
        setGoal(existing.goal);
        setAttachments(existing.attachments);
        const body = existing.editedBody ?? (existing.artifact ? existing.artifact.sections.map((s) => s.body).join("\n\n") : "");
        setText(body);
        setTone(existing.adjustments.tone ?? "");
        setLength(existing.adjustments.length ?? "");
      } else {
        setTask(newTask("write", taskId ? { id: taskId, workspaceId: taskId } : undefined));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [taskId]);

  // ---- autosave (debounced) ----
  const persist = React.useCallback(
    (patch: Partial<Task>) => {
      setTask((cur) => {
        if (!cur) return cur;
        const title = (patch.goal ?? cur.goal)?.trim().slice(0, 60) || firstLine(patch.editedBody ?? cur.editedBody ?? "") || "Untitled draft";
        const next: Task = {
          ...cur,
          ...patch,
          title,
          service: "write",
          updatedAt: new Date().toISOString(),
        };
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => {
          // Keep a synthesized artifact so it opens nicely in the Library.
          const body = next.editedBody ?? "";
          const withArtifact: Task = body.trim()
            ? { ...next, artifact: { service: "write", title: next.title, summary: firstLine(body, 120), sections: [{ heading: "Draft", body }], demo: false } }
            : next;
          saveTask(withArtifact)
            .then(() => setSavedAt(new Date().toISOString()))
            .catch(() => toast({ title: "Couldn't save to this browser's storage.", tone: "danger" }));
        }, 500);
        return next;
      });
    },
    [toast]
  );

  // Sync URL with the task id so a refresh restores the draft.
  React.useEffect(() => {
    if (!taskId && task && (text.trim() || goal.trim())) {
      window.history.replaceState(window.history.state, "", `/write?task=${task.id}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId, task?.id, text, goal]);

  // ---- live style hints (local, instant) ----
  const scheduleHints = React.useCallback((value: string) => {
    if (hintTimer.current) clearTimeout(hintTimer.current);
    hintTimer.current = setTimeout(() => setHints(lintText(value)), 400);
  }, []);

  // ---- ghost-text autocomplete ----
  const clearGhost = () => {
    setGhost("");
    ghostCtl.current?.abort();
    if (ghostTimer.current) clearTimeout(ghostTimer.current);
  };

  const scheduleGhost = React.useCallback(
    (value: string, caretAtEnd: boolean) => {
      if (ghostTimer.current) clearTimeout(ghostTimer.current);
      ghostCtl.current?.abort();
      setGhost("");
      if (!caretAtEnd || streaming || value.trim().length < 12) return;
      // Debounce ≥ 900ms; only the current paragraph is sent.
      ghostTimer.current = setTimeout(async () => {
        const ctl = new AbortController();
        ghostCtl.current = ctl;
        const para = value.slice(value.lastIndexOf("\n\n") + 1);
        const s = await fetchGhost(para, goal, ctl.signal);
        // Only show if the text hasn't changed since.
        if (!ctl.signal.aborted && textRef.current === value && s) setGhost(s.startsWith(" ") ? s : " " + s);
      }, 950);
    },
    [goal, streaming]
  );

  const onTextChange = (value: string) => {
    setText(value);
    persist({ editedBody: value });
    scheduleHints(value);
    const ta = taRef.current;
    const caretAtEnd = ta ? ta.selectionStart === value.length && ta.selectionEnd === value.length : false;
    scheduleGhost(value, caretAtEnd);
  };

  const acceptGhost = () => {
    if (!ghost) return;
    const next = text + ghost;
    setGhost("");
    setText(next);
    persist({ editedBody: next });
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
    if (e.key === "Escape" && ghost) {
      e.preventDefault();
      clearGhost();
      return;
    }
    if (ghost) clearGhost();
    // Cmd/Ctrl+Enter → continue writing.
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      runCompose("continue");
    }
  };

  // keep overlay scroll in sync with textarea
  const onScroll = () => {
    if (overlayRef.current && taRef.current) overlayRef.current.scrollTop = taRef.current.scrollTop;
  };

  // ---- compose (streaming) ----
  const contextText = React.useMemo(() => attachments.map((a) => a.text).filter(Boolean).join("\n\n"), [attachments]);

  const runCompose = (mode: "write" | "continue" | "improve") => {
    if (streaming) return;
    clearGhost();
    const ta = taRef.current;
    let selection = "";
    let selStart = text.length;
    let selEnd = text.length;
    if (mode === "improve" && ta) {
      selStart = ta.selectionStart;
      selEnd = ta.selectionEnd;
      selection = text.slice(selStart, selEnd);
      if (!selection.trim()) {
        toast({ title: "Select the text you want to improve first." });
        return;
      }
    }

    setStreaming(true);
    let acc = "";
    // For "write" into an empty editor we replace; otherwise we insert at the end / over selection.
    const replaceAll = mode === "write" && text.trim().length === 0;
    const base = text;

    streamCtl.current = streamCompose(
      {
        mode,
        goal,
        context: contextText,
        currentText: mode === "improve" ? base : base,
        selection,
        instruction: mode === "improve" ? "Make it clearer and more direct." : undefined,
        tone: tone || undefined,
        length: length || undefined,
      },
      {
        onDelta: (d) => {
          acc += d;
          if (mode === "improve") {
            const next = base.slice(0, selStart) + acc + base.slice(selEnd);
            setText(next);
          } else if (replaceAll) {
            setText(acc);
          } else {
            const sep = base.endsWith("\n") || !base ? "" : mode === "continue" ? "" : "\n\n";
            setText(base + sep + acc);
          }
        },
        onDone: () => {
          setStreaming(false);
          const finalText = textRef.current;
          persist({ editedBody: finalText, goal, adjustments: { tone: tone || undefined, length: length || undefined } });
          scheduleHints(finalText);
        },
        onError: (m) => {
          setStreaming(false);
          toast({ title: m, tone: "danger" });
        },
      }
    );
  };

  const stop = () => {
    streamCtl.current?.abort();
    setStreaming(false);
  };

  // Auto-write once when arriving from the home intake (?run=1) with a goal and empty draft.
  React.useEffect(() => {
    if (autorun && !started.current && task && goal.trim() && !text.trim() && !streaming) {
      started.current = true;
      runCompose("write");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autorun, task?.id, goal]);

  // ---- copy / export ----
  const doCopy = async () => {
    const ok = await copyToClipboard(text);
    toast({ title: ok ? "Copied to clipboard." : "Couldn't copy.", tone: ok ? "success" : "danger" });
  };
  const doExport = (ext: "md" | "txt") => {
    const name = exportFilename("write", task?.title || goal || "draft", ext);
    const ok = downloadText(name, text + "\n", ext === "md" ? "text/markdown" : "text/plain");
    toast(ok ? { title: "Exported", description: name, tone: "success" } : { title: "Couldn't export.", tone: "danger" });
  };

  React.useEffect(() => {
    return () => {
      streamCtl.current?.abort();
      ghostCtl.current?.abort();
      [ghostTimer, hintTimer, saveTimer].forEach((t) => t.current && clearTimeout(t.current));
    };
  }, []);

  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;

  return (
    <div className="flex min-h-dvh flex-col">
      {/* header */}
      <div className="sticky top-0 z-20 flex items-center gap-3 border-b border-line bg-canvas/95 px-4 py-2.5 backdrop-blur no-print sm:px-6">
        <span className="text-sm font-medium text-muted">Write</span>
        <span className="text-muted">·</span>
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{task?.title || "Untitled draft"}</span>
        <span className="hidden items-center gap-1.5 text-meta text-muted lg:flex">
          <Cloud className="h-3.5 w-3.5" /> {savedAt ? `Saved · ${relativeTime(savedAt)}` : "Saves automatically"}
        </span>
        <Button variant="secondary" size="sm" onClick={doCopy}>
          <Copy className="h-4 w-4" /> Copy
        </Button>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="secondary" size="sm">
              <Download className="h-4 w-4" /> Export
            </Button>
          </PopoverTrigger>
          <PopoverContent>
            <button className="flex w-full items-center rounded-btn px-2.5 py-2 text-left text-sm hover:bg-ink/[0.06]" onClick={() => doExport("md")}>Markdown (.md)</button>
            <button className="flex w-full items-center rounded-btn px-2.5 py-2 text-left text-sm hover:bg-ink/[0.06]" onClick={() => doExport("txt")}>Plain text (.txt)</button>
            <button className="flex w-full items-center rounded-btn px-2.5 py-2 text-left text-sm hover:bg-ink/[0.06]" onClick={() => window.print()}>
              <span className="inline-flex items-center gap-2"><Printer className="h-4 w-4" /> Print / PDF</span>
            </button>
          </PopoverContent>
        </Popover>
      </div>

      <div className="grid flex-1 lg:grid-cols-[300px_minmax(0,1fr)]">
        {/* left: what to write + actions */}
        <div className="space-y-5 border-b border-line p-4 sm:p-5 lg:border-b-0 lg:border-r no-print">
          <div>
            <Label htmlFor="ws-goal">What are you writing?</Label>
            <Textarea
              id="ws-goal"
              className="mt-1.5 min-h-[60px] text-sm"
              placeholder="e.g. A warm follow-up to Dana confirming the March start."
              value={goal}
              onChange={(e) => {
                setGoal(e.target.value);
                persist({ goal: e.target.value });
              }}
            />
          </div>

          <div>
            <Eyebrow>Context</Eyebrow>
            {attachments.length > 0 && (
              <ul className="mb-2 mt-2 space-y-1.5">
                {attachments.map((a) => (
                  <li key={a.id} className="flex items-center justify-between rounded-btn border border-line bg-canvas px-2.5 py-1.5 text-meta">
                    <span className="truncate text-ink/80">{a.label}</span>
                    <button className="text-muted hover:text-ink" onClick={() => { const next = attachments.filter((x) => x.id !== a.id); setAttachments(next); persist({ attachments: next }); }}>×</button>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-2">
              <AttachmentAdder attachments={attachments} onChange={(a) => { setAttachments(a); persist({ attachments: a }); }} compact />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor="ws-tone" className="text-meta text-muted">Tone</Label>
              <select id="ws-tone" value={tone} onChange={(e) => setTone(e.target.value)} className="mt-1 w-full rounded-btn border border-line bg-surface px-2.5 py-2 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/70">
                {TONES.map((t) => <option key={t} value={t}>{t || "Auto"}</option>)}
              </select>
            </div>
            <div>
              <Label htmlFor="ws-len" className="text-meta text-muted">Length</Label>
              <select id="ws-len" value={length} onChange={(e) => setLength(e.target.value)} className="mt-1 w-full rounded-btn border border-line bg-surface px-2.5 py-2 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/70">
                {LENGTHS.map((l) => <option key={l} value={l}>{l || "Auto"}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Button className="w-full" onClick={() => runCompose("write")} disabled={streaming}>
              <Sparkles className="h-4 w-4" /> {text.trim() ? "Rewrite from notes" : "Write it for me"}
            </Button>
            <Button variant="secondary" className="w-full" onClick={() => runCompose("continue")} disabled={streaming || !text.trim()}>
              <ArrowDown className="h-4 w-4" /> Continue writing
            </Button>
            <Button variant="secondary" className="w-full" onClick={() => runCompose("improve")} disabled={streaming}>
              <Wand2 className="h-4 w-4" /> Improve selection
            </Button>
            <p className="text-meta text-muted">Type freely — press <kbd className="rounded border border-line bg-surface px-1">Tab</kbd> to accept a suggestion, <kbd className="rounded border border-line bg-surface px-1">⌘↵</kbd> to continue.</p>
          </div>
        </div>

        {/* center: the editor */}
        <div className="flex min-w-0 flex-col">
          <div className="relative flex-1">
            {/* ghost overlay */}
            <div
              ref={overlayRef}
              aria-hidden
              className="pointer-events-none absolute inset-0 overflow-auto whitespace-pre-wrap break-words px-5 py-5 text-base leading-relaxed text-transparent sm:px-8"
            >
              {text}
              {ghost && <span className="text-muted/70">{ghost}</span>}
              {ghost && <span className="ml-1 align-middle text-meta text-muted/80">⇥</span>}
            </div>
            <textarea
              ref={taRef}
              value={text}
              onChange={(e) => onTextChange(e.target.value)}
              onKeyDown={onKeyDown}
              onScroll={onScroll}
              onSelect={() => ghost && clearGhost()}
              disabled={streaming}
              spellCheck
              placeholder="Start writing, or use “Write it for me” on the left…"
              className={cn(
                "absolute inset-0 h-full w-full resize-none bg-transparent px-5 py-5 text-base leading-relaxed text-ink caret-ink placeholder:text-muted focus-visible:outline-none sm:px-8",
                streaming && "opacity-90"
              )}
            />
          </div>

          {/* status / hints bar */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-line px-5 py-2 no-print sm:px-8">
            {streaming ? (
              <span className="inline-flex items-center gap-2 text-sm text-ink/80">
                <Spinner /> Writing…
                <button onClick={stop} className="inline-flex items-center gap-1 text-meta text-muted underline underline-offset-2 hover:text-ink">
                  <StopCircle className="h-3.5 w-3.5" /> Stop
                </button>
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
                {ghost && (
                  <span className="inline-flex items-center gap-1 text-meta text-muted">
                    <CornerDownLeft className="h-3.5 w-3.5" /> suggestion ready — Tab to accept
                  </span>
                )}
                {!text.trim() && <span className="text-meta text-muted">Tip: jot a few notes, then “Write it for me”.</span>}
              </>
            )}
            <span className="ml-auto">
              <Badge tone="neutral">Draft</Badge>
            </span>
          </div>
        </div>
      </div>

      {/* print surface */}
      <div className="print-document hidden print:block">
        <h1>{task?.title || "Draft"}</h1>
        <div style={{ whiteSpace: "pre-wrap" }}>{text}</div>
      </div>
    </div>
  );
}

function firstLine(s: string, max = 60): string {
  const line = (s || "").split("\n").map((l) => l.trim()).find(Boolean) ?? "";
  return line.replace(/^#+\s*/, "").slice(0, max);
}

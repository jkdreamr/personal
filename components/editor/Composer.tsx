"use client";

import * as React from "react";
import type { Editor } from "@tiptap/react";
import { Sparkles, ArrowDown, Wand2, StopCircle, CornerDownLeft } from "lucide-react";
import { streamCompose } from "@/lib/client/compose";
import { lintText, type StyleWarning } from "@/lib/editorial/style-lint";
import { markdownToDoc, toProseMirrorDoc, docToText, isDocEmpty, type RichDoc } from "@/lib/richdoc";
import { RichDocumentEditor, type RichEditorChange } from "./RichDocumentEditor";
import { useGhostText } from "./useGhostText";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/primitives";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/overlays";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

export type ComposerAction = "write" | "continue" | "improve";

/** Quick presets for "Improve selection" — alongside a freeform natural-language instruction. */
const IMPROVE_PRESETS: { label: string; instruction: string }[] = [
  { label: "Shorter", instruction: "Make this shorter and tighter without losing meaning." },
  { label: "Longer", instruction: "Expand this with more useful detail and specifics; keep it on point." },
  { label: "Clearer", instruction: "Make this clearer and more direct; simplify any awkward phrasing." },
  { label: "More human", instruction: "Rewrite this so it sounds natural and human — less stiff, less generic. Keep the meaning and facts." },
  { label: "More formal", instruction: "Make this more formal and professional." },
  { label: "Warmer", instruction: "Make this warmer and more conversational, while staying professional." },
];

/**
 * The reusable rich writing surface. A Tiptap document editor with a formatting toolbar, streaming
 * Write / Continue actions, and an Improve-selection flow that preserves the exact selected range
 * (highlighted via an editor decoration) through a preset + freeform instruction panel and replaces
 * only that range as a single undoable action. Used by the Write studio and every tool's edit mode.
 */
export function Composer({
  doc,
  initialMarkdown,
  onDocChange,
  goal,
  context,
  tone,
  length,
  actions = ["continue", "improve"],
  placeholder = "Start writing, or use the actions above…",
  minHeightClass = "min-h-[280px]",
  autoRun,
  onStreamingChange,
}: {
  doc?: RichDoc | null;
  /** Markdown to seed the editor when there is no canonical `doc` yet (legacy edit or generated body). */
  initialMarkdown?: string;
  onDocChange: (doc: RichDoc, markdown: string) => void;
  goal?: string;
  context?: string;
  tone?: string;
  length?: string;
  actions?: ComposerAction[];
  placeholder?: string;
  minHeightClass?: string;
  autoRun?: "write";
  onStreamingChange?: (streaming: boolean) => void;
}) {
  const { toast } = useToast();
  // Seed once: prefer the canonical doc; otherwise parse the markdown seed. markdownToDoc lives in
  // this (dynamically-loaded) chunk so Tiptap never enters the base service bundle.
  const seedDoc = React.useMemo(
    () => doc ?? (initialMarkdown && initialMarkdown.trim() ? markdownToDoc(initialMarkdown) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );
  const editorRef = React.useRef<Editor | null>(null);
  const [editorInstance, setEditorInstance] = React.useState<Editor | null>(null);
  const [streaming, setStreaming] = React.useState(false);
  const [streamText, setStreamText] = React.useState("");
  const [hints, setHints] = React.useState<StyleWarning[]>(() => lintText(docToText(seedDoc)));
  const [wordCount, setWordCount] = React.useState(() => {
    const t = docToText(seedDoc).trim();
    return t ? t.split(/\s+/).length : 0;
  });

  // Improve-selection panel state.
  const [improveOpen, setImproveOpen] = React.useState(false);
  const [preset, setPreset] = React.useState<string | null>(null);
  const [custom, setCustom] = React.useState("");
  const selectionRef = React.useRef<{ from: number; to: number; text: string } | null>(null);

  const streamCtl = React.useRef<AbortController | null>(null);
  const hintTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const textRef = React.useRef(docToText(seedDoc));
  const isEmptyRef = React.useRef(isDocEmpty(seedDoc));
  const autoRan = React.useRef(false);
  const streamingRef = React.useRef(false);

  const setStreamingState = (b: boolean) => {
    setStreaming(b);
    streamingRef.current = b;
    onStreamingChange?.(b);
  };

  const scheduleHints = React.useCallback((text: string) => {
    if (hintTimer.current) clearTimeout(hintTimer.current);
    hintTimer.current = setTimeout(() => setHints(lintText(text)), 400);
  }, []);

  const handleChange = React.useCallback(
    (change: RichEditorChange) => {
      textRef.current = change.text;
      isEmptyRef.current = change.isEmpty;
      setWordCount(change.text.trim() ? change.text.trim().split(/\s+/).length : 0);
      onDocChange(change.doc, change.markdown);
      scheduleHints(change.text);
    },
    [onDocChange, scheduleHints]
  );

  const maybeAutoRun = React.useCallback(() => {
    if (autoRun === "write" && !autoRan.current && goal?.trim() && isEmptyRef.current && !streamingRef.current) {
      autoRan.current = true;
      run("write");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRun, goal]);

  const onReady = React.useCallback(
    (editor: Editor) => {
      editorRef.current = editor;
      setEditorInstance(editor);
      maybeAutoRun();
    },
    [maybeAutoRun]
  );

  // Cursor-anchored ghost autocomplete (paused while a stream is running).
  useGhostText(editorInstance, { goal, enabled: !streaming });

  // ---- streaming Write / Continue / Improve --------------------------------

  const commitStream = (mode: ComposerAction, acc: string, sel: { from: number; to: number } | null) => {
    const editor = editorRef.current;
    if (!editor) return;
    const text = acc.trim();
    if (!text) return;
    if (mode === "improve" && sel) {
      // Replace EXACTLY the selected range with the rewrite — one undoable transaction — and clear
      // the highlight. Surrounding formatting is untouched.
      editor.chain().focus().clearImproveHighlight().insertContentAt({ from: sel.from, to: sel.to }, text).run();
      selectionRef.current = null;
    } else if (mode === "write" && isEmptyRef.current) {
      editor.commands.setContent(toProseMirrorDoc(markdownToDoc(text)));
    } else {
      const parsed = markdownToDoc(text);
      editor.chain().focus("end").insertContent(parsed.content).run();
    }
  };

  const run = (mode: ComposerAction, instruction?: string) => {
    if (streamingRef.current) return;
    const editor = editorRef.current;
    if (!editor) return;

    let sel: { from: number; to: number; text: string } | null = null;
    if (mode === "improve") {
      sel = selectionRef.current;
      if (!sel || !sel.text.trim()) {
        toast({ title: "Select the text you want to improve first." });
        return;
      }
    }

    setStreamingState(true);
    setStreamText("");
    let acc = "";
    streamCtl.current = streamCompose(
      {
        mode,
        goal,
        context,
        currentText: textRef.current,
        selection: sel?.text ?? "",
        instruction,
        tone: tone || undefined,
        length: length || undefined,
      },
      {
        onDelta: (d) => {
          acc += d;
          setStreamText(acc);
        },
        onDone: () => {
          commitStream(mode, acc, sel ? { from: sel.from, to: sel.to } : null);
          setStreamingState(false);
        },
        onError: (m) => {
          setStreamingState(false);
          editor.commands.clearImproveHighlight();
          toast({ title: m, tone: "danger" });
        },
      }
    );
  };

  const stop = () => {
    streamCtl.current?.abort();
    setStreamingState(false);
    editorRef.current?.commands.clearImproveHighlight();
  };

  // ---- Improve panel open/close (captures + highlights the selection) ------

  const openImprove = () => {
    const editor = editorRef.current;
    if (!editor) return;
    const { from, to, empty } = editor.state.selection;
    if (empty) {
      toast({ title: "Select the text you want to improve first." });
      return;
    }
    const text = editor.state.doc.textBetween(from, to, " ");
    selectionRef.current = { from, to, text };
    editor.commands.setImproveHighlight({ from, to });
    setPreset(null);
    setCustom("");
    setImproveOpen(true);
  };

  const closeImprove = (apply: boolean) => {
    setImproveOpen(false);
    const editor = editorRef.current;
    if (!apply) {
      editor?.commands.clearImproveHighlight();
      const sel = selectionRef.current;
      if (editor && sel) editor.chain().focus().setTextSelection({ from: sel.from, to: sel.to }).run();
      selectionRef.current = null;
    }
  };

  const applyImprove = () => {
    const instruction = custom.trim() || (preset ? IMPROVE_PRESETS.find((p) => p.label === preset)?.instruction : "");
    if (!instruction) return;
    setImproveOpen(false);
    run("improve", instruction);
  };

  const canApply = Boolean(custom.trim().length > 1 || preset);

  React.useEffect(() => {
    return () => {
      streamCtl.current?.abort();
      if (hintTimer.current) clearTimeout(hintTimer.current);
    };
  }, []);

  const selPreview = selectionRef.current?.text ?? "";
  const writeLabel = isEmptyRef.current ? "Write it for me" : "Rewrite";

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
          <Button size="sm" variant="secondary" onClick={() => run("continue")} disabled={streaming}>
            <ArrowDown className="h-4 w-4" /> Continue
          </Button>
        )}
        {actions.includes("improve") && (
          <Popover open={improveOpen} onOpenChange={(o) => (o ? openImprove() : closeImprove(false))}>
            <PopoverTrigger asChild>
              <Button
                size="sm"
                variant="secondary"
                disabled={streaming}
                // Keep the editor focused so the text selection isn't collapsed before we capture it.
                onMouseDown={(e) => e.preventDefault()}
              >
                <Wand2 className="h-4 w-4" /> Improve selection
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-[20rem]">
              <p className="text-meta font-medium text-muted">Improve the selected text</p>
              {selPreview && (
                <p className="mt-1.5 max-h-16 overflow-auto rounded-btn bg-ink/[0.04] px-2.5 py-1.5 text-sm text-ink/80">
                  “{selPreview.length > 160 ? selPreview.slice(0, 160) + "…" : selPreview}”
                </p>
              )}
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {IMPROVE_PRESETS.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => setPreset((cur) => (cur === p.label ? null : p.label))}
                    aria-pressed={preset === p.label}
                    className={cn(
                      "rounded-chip border px-2.5 py-1 text-meta transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/70",
                      preset === p.label ? "border-ink/30 bg-ink/[0.10] text-ink" : "border-line text-ink/80 hover:bg-ink/[0.05]"
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <label htmlFor="rd-improve-custom" className="mt-3 block text-meta text-muted">
                Or describe the change
              </label>
              <textarea
                id="rd-improve-custom"
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && canApply) {
                    e.preventDefault();
                    applyImprove();
                  }
                  if (e.key === "Escape") {
                    e.preventDefault();
                    closeImprove(false);
                  }
                }}
                rows={2}
                placeholder='e.g. I don&apos;t like the word "utilize" — use something simpler and rewrite the sentence.'
                className="mt-1 w-full resize-none rounded-btn border border-line bg-surface px-2.5 py-1.5 text-sm text-ink placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/70"
              />
              <div className="mt-2.5 flex items-center justify-between">
                <button onClick={() => closeImprove(false)} className="text-meta text-muted underline underline-offset-2 hover:text-ink">
                  Cancel
                </button>
                <Button size="sm" onClick={applyImprove} disabled={!canApply}>
                  Apply <CornerDownLeft className="h-3.5 w-3.5" />
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        )}
        {streaming && (
          <button onClick={stop} className="inline-flex items-center gap-1 text-meta text-muted underline underline-offset-2 hover:text-ink">
            <StopCircle className="h-3.5 w-3.5" /> Stop
          </button>
        )}
      </div>

      {/* The editor stays mounted at all times (so streamed content commits to the live instance and
          survives); during streaming it is hidden and a calm live preview takes its place. */}
      <div className={cn(streaming && "hidden")}>
        <RichDocumentEditor
          initialDoc={seedDoc}
          placeholder={placeholder}
          minHeightClass={minHeightClass}
          ariaLabel="Document editor"
          onChange={handleChange}
          onReady={onReady}
        />
      </div>
      {streaming && (
        <div className="rich-editor" aria-live="polite">
          <div className={cn("rounded-card border border-line bg-surface", minHeightClass)}>
            <div className="ProseMirror whitespace-pre-wrap px-3.5 py-3 text-ink">
              {streamText}
              <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-ink/60 align-text-bottom" aria-hidden />
            </div>
          </div>
        </div>
      )}

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
                      <li key={i} className="rounded-btn px-2 py-1.5 text-sm text-ink/85 hover:bg-ink/[0.04]">
                        {h.message}
                      </li>
                    ))}
                  </ul>
                </PopoverContent>
              </Popover>
            )}
            <span className="text-meta text-muted">Suggestions appear as you write — Tab to accept · select text to Improve</span>
          </>
        )}
      </div>
    </div>
  );
}

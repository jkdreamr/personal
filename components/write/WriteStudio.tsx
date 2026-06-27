"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { Copy, Download, Printer, Cloud } from "lucide-react";
import type { Attachment, Task } from "@/lib/types";
import { getTask, newTask, saveTask } from "@/lib/db/tasks";
import { downloadText, copyToClipboard } from "@/lib/client/download";
import { exportFilename } from "@/lib/export/filename";
import { relativeTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea, Label } from "@/components/ui/field";
import { Eyebrow } from "@/components/ui/primitives";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/overlays";
import dynamic from "next/dynamic";
import { AttachmentAdder } from "@/components/workspace/AttachmentAdder";
import type { RichDoc } from "@/lib/richdoc/types";
import { useToast } from "@/components/ui/toast";

// Load the rich editor on demand so the studio shell paints first.
const Composer = dynamic(() => import("@/components/editor/Composer").then((m) => m.Composer), {
  ssr: false,
  loading: () => <div className="min-h-[60vh] rounded-card border border-line bg-surface" aria-hidden />,
});

const TONES = ["", "Direct", "Professional", "Warm", "Formal"];
const LENGTHS = ["", "Short", "Balanced", "Thorough"];

export function WriteStudio() {
  return (
    <React.Suspense fallback={null}>
      <Studio />
    </React.Suspense>
  );
}

function Studio() {
  const sp = useSearchParams();
  const taskId = sp.get("task") ?? undefined;
  const autorun = sp.get("run") === "1";
  const { toast } = useToast();

  const [task, setTask] = React.useState<Task | null>(null);
  const [goal, setGoal] = React.useState("");
  const [attachments, setAttachments] = React.useState<Attachment[]>([]);
  // Canonical rich document + its derived markdown (for copy/export/print and AI context).
  const [docState, setDocState] = React.useState<RichDoc | null>(null);
  const [markdown, setMarkdown] = React.useState("");
  const [tone, setTone] = React.useState("");
  const [length, setLength] = React.useState("");
  const [savedAt, setSavedAt] = React.useState<string | null>(null);

  const saveTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const existing = taskId ? await getTask(taskId) : undefined;
      if (cancelled) return;
      if (existing) {
        setTask(existing);
        setGoal(existing.goal);
        setAttachments(existing.attachments);
        // Prefer the canonical doc; else seed the editor from a legacy edit / existing draft artifact.
        const seedMd = existing.editedBody ?? (existing.artifact ? existing.artifact.sections.map((s) => s.body).join("\n\n") : "");
        setDocState(existing.doc ?? null);
        setMarkdown(seedMd);
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

  const persist = React.useCallback(
    (patch: Partial<Task>) => {
      setTask((cur) => {
        if (!cur) return cur;
        const title = (patch.goal ?? cur.goal)?.trim().slice(0, 60) || firstLine(patch.editedBody ?? cur.editedBody ?? "") || "Untitled draft";
        const next: Task = { ...cur, ...patch, title, service: "write", updatedAt: new Date().toISOString() };
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => {
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

  // Reflect the task id in the URL so a refresh restores the draft.
  React.useEffect(() => {
    if (!taskId && task && (markdown.trim() || goal.trim())) {
      window.history.replaceState(window.history.state, "", `/write?task=${task.id}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId, task?.id, markdown, goal]);

  const onDoc = (d: RichDoc, md: string) => {
    setDocState(d);
    setMarkdown(md);
    persist({ doc: d, editedBody: md });
  };

  const contextText = React.useMemo(() => attachments.map((a) => a.text).filter(Boolean).join("\n\n"), [attachments]);

  const doCopy = async () => {
    const ok = await copyToClipboard(markdown);
    toast({ title: ok ? "Copied to clipboard." : "Couldn't copy.", tone: ok ? "success" : "danger" });
  };
  const doExport = (ext: "md" | "txt") => {
    const name = exportFilename("write", task?.title || goal || "draft", ext);
    const ok = downloadText(name, markdown + "\n", ext === "md" ? "text/markdown" : "text/plain");
    toast(ok ? { title: "Exported", description: name, tone: "success" } : { title: "Couldn't export.", tone: "danger" });
  };

  React.useEffect(() => () => void (saveTimer.current && clearTimeout(saveTimer.current)), []);

  return (
    <div className="flex min-h-dvh flex-col">
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
        {/* left: what to write + context */}
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
              <select id="ws-tone" value={tone} onChange={(e) => { setTone(e.target.value); persist({ adjustments: { ...task?.adjustments, tone: e.target.value || undefined } }); }} className="mt-1 w-full rounded-btn border border-line bg-surface px-2.5 py-2 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/70">
                {TONES.map((t) => <option key={t} value={t}>{t || "Auto"}</option>)}
              </select>
            </div>
            <div>
              <Label htmlFor="ws-len" className="text-meta text-muted">Length</Label>
              <select id="ws-len" value={length} onChange={(e) => { setLength(e.target.value); persist({ adjustments: { ...task?.adjustments, length: e.target.value || undefined } }); }} className="mt-1 w-full rounded-btn border border-line bg-surface px-2.5 py-2 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/70">
                {LENGTHS.map((l) => <option key={l} value={l}>{l || "Auto"}</option>)}
              </select>
            </div>
          </div>
          <p className="text-meta text-muted">A clean document editor — format with the toolbar or ⌘B/I/U. Select text and Improve, or Continue from the end.</p>
        </div>

        {/* center: the editor */}
        <div className="min-w-0 p-4 sm:p-6">
          <Composer
            key={task?.id ?? "new"}
            doc={docState}
            initialMarkdown={markdown}
            onDocChange={onDoc}
            goal={goal}
            context={contextText}
            tone={tone}
            length={length}
            actions={["write", "continue", "improve"]}
            autoRun={autorun ? "write" : undefined}
            minHeightClass="min-h-[60vh]"
            placeholder="Start writing, or use “Write it for me” above…"
          />
        </div>
      </div>

      <div className="print-document hidden print:block">
        <h1>{task?.title || "Draft"}</h1>
        <div style={{ whiteSpace: "pre-wrap" }}>{markdown}</div>
      </div>
    </div>
  );
}

function firstLine(s: string, max = 60): string {
  const line = (s || "").split("\n").map((l) => l.trim()).find(Boolean) ?? "";
  return line.replace(/^#+\s*/, "").slice(0, max);
}

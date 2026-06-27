"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, RotateCcw, Cloud } from "lucide-react";
import type { ServiceId } from "@/lib/services";
import { SERVICES } from "@/lib/services";
import { useTask } from "@/hooks/useTask";
import { duplicateTask } from "@/lib/db/tasks";
import { relativeTime, cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { Skeleton, Spinner } from "@/components/ui/primitives";
import { Segmented } from "@/components/ui/segmented";
import { useToast } from "@/components/ui/toast";
import { ServiceIcon } from "@/components/ui/icon";
import { AttachmentAdder } from "./AttachmentAdder";
import { AttachmentList } from "./AttachmentList";
import { ContextPanel } from "./ContextPanel";
import { ArtifactBody } from "./ArtifactBody";
import { SourcesPanel } from "./SourcesPanel";
import { Toolbar } from "./Toolbar";

type MobilePane = "context" | "work" | "sources";

export function Workspace({ serviceId, taskId, autorun }: { serviceId: ServiceId; taskId?: string; autorun?: boolean }) {
  const service = SERVICES[serviceId];
  const router = useRouter();
  const { toast } = useToast();
  const { task, loaded, status, stages, error, coverage, update, run, cancel, retry, refine, setError } = useTask(serviceId, taskId);
  const [pane, setPane] = React.useState<MobilePane>("work");
  const [startMode, setStartMode] = React.useState<"fresh" | "draft">("fresh");
  const ranOnce = React.useRef(false);

  // Once a run starts (or a result exists), reflect the task id in the URL using the
  // History API — so a refresh restores this exact task without remounting mid-run.
  React.useEffect(() => {
    if (!taskId && task && (status === "running" || status === "done")) {
      window.history.replaceState(window.history.state, "", `/${serviceId}?task=${task.id}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId, task?.id, status, serviceId]);

  // Auto-run once when arriving from intake with a goal and no result yet.
  React.useEffect(() => {
    if (autorun && loaded && task && !ranOnce.current && task.goal.trim() && !task.artifact && status === "idle") {
      ranOnce.current = true;
      run();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autorun, loaded, task?.id, status]);

  if (!loaded || !task) {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-4 h-40 w-full" />
      </div>
    );
  }

  const hasArtifact = Boolean(task.artifact);
  const running = status === "running";
  const showFirstScreen = !hasArtifact && !running && status !== "error";

  const onDuplicate = async () => {
    const copy = await duplicateTask(task.id);
    if (copy) {
      toast({ title: "Duplicated", description: "Opened a copy you can change freely." });
      router.push(`/${serviceId}?task=${copy.id}`);
    }
  };

  const canRun = task.goal.trim().length > 0 || task.attachments.some((a) => a.text.trim() || a.kind === "link");

  // ---------- First screen ----------
  if (showFirstScreen) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-10 sm:py-16">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-card border border-line bg-surface">
            <ServiceIcon name={service.icon} className="h-5 w-5 text-ink" />
          </span>
          <span className="text-sm font-medium text-muted">{service.label}</span>
        </div>
        {(() => {
          const draftMode = service.capabilities.acceptsDraft && startMode === "draft";
          const canStart = draftMode ? Boolean(task.draft?.trim()) : canRun;
          return (
            <>
              <h1 className="mt-5 text-2xl font-semibold leading-tight text-ink sm:text-[1.75rem]">{service.hero.heading}</h1>
              {service.hero.helper && !draftMode && <p className="mt-2 text-base text-ink/65">{service.hero.helper}</p>}

              {service.capabilities.acceptsDraft && (
                <div role="tablist" aria-label="How to start" className="mt-5 inline-flex rounded-btn border border-line bg-surface p-0.5">
                  {(
                    [
                      ["fresh", "Start from scratch"],
                      ["draft", "I already have a draft"],
                    ] as const
                  ).map(([m, label]) => (
                    <button
                      key={m}
                      role="tab"
                      aria-selected={startMode === m}
                      onClick={() => setStartMode(m)}
                      className={cn(
                        "rounded-[6px] px-3 py-1.5 text-meta font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/70",
                        startMode === m ? "bg-canvas text-ink shadow-sm" : "text-muted hover:text-ink"
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}

              {draftMode ? (
                <>
                  <div className="mt-5">
                    <Textarea
                      autoFocus
                      aria-label="Your draft"
                      className="min-h-[220px] text-base"
                      placeholder={service.draftPlaceholder ?? "Paste what you’ve already written…"}
                      value={task.draft ?? ""}
                      onChange={(e) => update({ draft: e.target.value, title: e.target.value.split("\n")[0]?.slice(0, 60) || "Untitled" })}
                    />
                  </div>
                  <div className="mt-3">
                    <label htmlFor="draft-focus" className="text-meta text-muted">
                      Anything to focus on? (optional)
                    </label>
                    <Textarea
                      id="draft-focus"
                      className="mt-1 min-h-[44px] text-sm"
                      placeholder="e.g. make it more concise; keep the tone formal"
                      value={task.goal}
                      onChange={(e) => update({ goal: e.target.value })}
                      onKeyDown={(e) => {
                        if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && canStart) run();
                      }}
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="mt-6">
                    <Textarea
                      autoFocus
                      aria-label={service.hero.heading}
                      className="min-h-[110px] text-base"
                      placeholder={service.hero.placeholder}
                      value={task.goal}
                      onChange={(e) => update({ goal: e.target.value, title: e.target.value.slice(0, 60) || "Untitled" })}
                      onKeyDown={(e) => {
                        if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && canStart) run();
                      }}
                    />
                  </div>

                  <div className="mt-4">
                    <p className="mb-2 text-sm text-muted">Add what you have (optional)</p>
                    <AttachmentAdder
                      attachments={task.attachments}
                      onChange={(a) => update({ attachments: a })}
                      acceptsFiles={service.capabilities.acceptsFiles}
                      acceptsLinks={service.capabilities.acceptsLinks}
                    />
                  </div>

                  <AttachmentList attachments={task.attachments} onChange={(a) => update({ attachments: a })} className="mt-3" />
                </>
              )}

              <div className="mt-6 flex items-center gap-3">
                <Button size="lg" onClick={() => run()} disabled={!canStart}>
                  {draftMode ? service.draftCta ?? "Improve my draft" : service.hero.button} <ArrowRight className="h-4 w-4" />
                </Button>
                <span className="text-meta text-muted">⌘↵ to start</span>
              </div>
            </>
          );
        })()}
      </div>
    );
  }

  // ---------- Working / result layout ----------
  const header = (
    <div className="sticky top-0 z-20 border-b border-line bg-canvas/95 backdrop-blur no-print">
      <div className="flex items-center gap-3 px-4 py-2.5 sm:px-6">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <span className="hidden shrink-0 items-center gap-1.5 text-sm font-medium text-muted sm:flex">
            <ServiceIcon name={service.icon} className="h-4 w-4" />
            {service.label}
          </span>
          <span className="hidden text-muted sm:inline">·</span>
          <input
            aria-label="Task title"
            value={task.title}
            onChange={(e) => update({ title: e.target.value })}
            className="min-w-0 flex-1 truncate rounded bg-transparent text-sm font-medium text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/70"
          />
        </div>
        <span className="hidden items-center gap-1.5 text-meta text-muted lg:flex">
          <Cloud className="h-3.5 w-3.5" /> Saved locally · {relativeTime(task.updatedAt)}
        </span>
        {hasArtifact && task.artifact && (
          <Toolbar service={serviceId} artifact={task.artifact} editedBody={task.editedBody} taskId={task.id} onDuplicate={onDuplicate} />
        )}
      </div>
    </div>
  );

  return (
    <div className="flex min-h-dvh flex-col">
      {header}

      {/* Mobile pane switcher */}
      <div className="border-b border-line px-4 py-2 lg:hidden no-print">
        <Segmented<MobilePane>
          aria-label="Workspace panels"
          value={pane}
          onChange={setPane}
          options={[
            { value: "context", label: "Context" },
            { value: "work", label: "Work" },
            { value: "sources", label: "Sources" },
          ]}
        />
      </div>

      <div className="grid flex-1 lg:grid-cols-[320px_minmax(0,1fr)_320px]">
        {/* Left: context */}
        <div className={`${pane === "context" ? "block" : "hidden"} border-r border-line p-4 sm:p-5 lg:block no-print`}>
          <ContextPanel
            service={service}
            goal={task.goal}
            attachments={task.attachments}
            adjustments={task.adjustments}
            assumptions={task.artifact?.assumptions}
            hasResult={hasArtifact}
            running={running}
            onGoal={(g) => update({ goal: g })}
            onAttachments={(a) => update({ attachments: a })}
            onAdjust={(a) => update({ adjustments: a })}
            onRefine={(instr) => refine(instr)}
            onApplyAdjustments={() => run()}
            onSecondOpinion={() => run({ adjustments: { ...task.adjustments, secondOpinion: true } })}
          />
        </div>

        {/* Center: work */}
        <div className={`${pane === "work" ? "block" : "hidden"} min-w-0 px-4 py-5 sm:px-8 lg:block`}>
          <div className="mx-auto max-w-prose">
            {running && (
              <div className="space-y-5">
                <div className="flex items-center gap-3">
                  <Spinner />
                  <span className="text-sm text-ink/80" aria-live="polite">
                    {stages.find((s) => s.state === "active")?.label ?? "Working"}…
                  </span>
                  <button onClick={cancel} className="ml-auto text-meta text-muted underline underline-offset-2 hover:text-ink">
                    Cancel
                  </button>
                </div>
                {!task.artifact && (
                  <div className="space-y-3">
                    <Skeleton className="h-7 w-2/3" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-11/12" />
                    <Skeleton className="h-4 w-4/5" />
                  </div>
                )}
              </div>
            )}

            {status === "error" && !running && (
              <div className="rounded-card border border-danger/30 bg-danger/[0.05] p-5" role="alert">
                <p className="text-sm text-ink">{error}</p>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" onClick={retry}>
                    <RotateCcw className="h-4 w-4" /> Try again
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setError(null)}>
                    Dismiss
                  </Button>
                </div>
              </div>
            )}

            {task.artifact && !running && (
              <ArtifactBody
                artifact={task.artifact}
                doc={task.doc}
                editedBody={task.editedBody}
                onDoc={(d, md) => update({ doc: d, editedBody: md })}
                editable
                goal={task.goal}
                context={task.attachments.map((a) => a.text).filter(Boolean).join("\n\n")}
                editorActions={service.capabilities.editorContinue ? ["continue", "improve"] : ["improve"]}
              />
            )}
          </div>
        </div>

        {/* Right: sources */}
        <div className={`${pane === "sources" ? "block" : "hidden"} border-l border-line p-4 sm:p-5 lg:block no-print`}>
          <SourcesPanel artifact={task.artifact} coverage={coverage} />
        </div>
      </div>
    </div>
  );
}

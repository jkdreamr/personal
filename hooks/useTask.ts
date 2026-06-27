"use client";

import * as React from "react";
import type { ServiceId } from "@/lib/services";
import { SERVICES } from "@/lib/services";
import type { Adjustments, Artifact, Attachment, Source, Stage, Task } from "@/lib/types";
import { getTask, newTask, saveTask, incrementBudget } from "@/lib/db/tasks";
import { runTaskStream } from "@/lib/client/run-task";
import { FREE_DAILY_TASK_BUDGET } from "@/lib/client/config";

const BASE_STAGES: Stage[] = [
  { id: "received", label: "Context received", state: "pending" },
  { id: "understanding", label: "Understanding your material", state: "pending" },
  { id: "drafting", label: "Creating your draft", state: "pending" },
  { id: "ready", label: "Ready for review", state: "pending" },
];

export type TaskStatus = "idle" | "running" | "done" | "error" | "cancelled";

export function useTask(serviceId: ServiceId, taskId?: string) {
  const [task, setTask] = React.useState<Task | null>(null);
  const [status, setStatus] = React.useState<TaskStatus>("idle");
  const [stages, setStages] = React.useState<Stage[]>(BASE_STAGES);
  const [error, setError] = React.useState<string | null>(null);
  const [coverage, setCoverage] = React.useState<string | null>(null);
  const [modelUsed, setModelUsed] = React.useState<string | null>(null);
  const [loaded, setLoaded] = React.useState(false);

  const abortRef = React.useRef<AbortController | null>(null);
  const saveTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const taskRef = React.useRef<Task | null>(null);
  taskRef.current = task;

  // Load existing task or create a fresh one.
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      if (taskId) {
        const existing = await getTask(taskId);
        if (!cancelled && existing) {
          setTask(existing);
          if (existing.artifact) setStatus("done");
          setLoaded(true);
          return;
        }
      }
      if (!cancelled) {
        setTask(newTask(serviceId, taskId ? { id: taskId, workspaceId: taskId } : undefined));
        setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId, serviceId]);

  const persist = React.useCallback((next: Task, immediate = false) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    const doSave = () => {
      saveTask(next).catch(() => {
        // Surface quota errors without losing in-memory work.
        setError("Harbor couldn't save to this browser's storage (it may be full). Your work is still on screen — export it to be safe.");
      });
    };
    if (immediate) doSave();
    else saveTimer.current = setTimeout(doSave, 600);
  }, []);

  const update = React.useCallback(
    (patch: Partial<Task>, opts?: { immediate?: boolean }) => {
      setTask((cur) => {
        if (!cur) return cur;
        const next = { ...cur, ...patch, updatedAt: new Date().toISOString() };
        persist(next, opts?.immediate);
        return next;
      });
    },
    [persist]
  );

  const run = React.useCallback(
    (overrides?: { adjustments?: Adjustments }) => {
      const current = taskRef.current;
      if (!current) return;
      const adjustments = overrides?.adjustments ?? current.adjustments;

      setError(null);
      setCoverage(null);
      setStatus("running");
      const usesResearch = SERVICES[serviceId].capabilities.usesResearch;
      const hasLinks = current.attachments.some((a) => a.kind === "link");
      setStages(
        usesResearch && hasLinks
          ? [
              { id: "received", label: "Context received", state: "done" },
              { id: "understanding", label: "Understanding your material", state: "active" },
              { id: "sources", label: "Checking sources", state: "pending" },
              { id: "drafting", label: "Creating your draft", state: "pending" },
              { id: "ready", label: "Ready for review", state: "pending" },
            ]
          : BASE_STAGES.map((s, i) => (i === 0 ? { ...s, state: "done" } : i === 1 ? { ...s, state: "active" } : s))
      );

      // Mark running + persist so a refresh shows the saved context.
      update({ state: "running", adjustments }, { immediate: true });

      abortRef.current = runTaskStream(
        {
          service: serviceId,
          goal: current.goal,
          attachments: current.attachments,
          adjustments,
          voiceProfile: null,
        },
        {
          onStage: (stage) =>
            setStages((cur) => {
              const exists = cur.some((s) => s.id === stage.id);
              const merged = exists ? cur.map((s) => (s.id === stage.id ? stage : s)) : insertStage(cur, stage);
              return merged;
            }),
          onSources: (sources, cov) => {
            if (cov) setCoverage(cov);
            setTask((cur) => (cur ? { ...cur, artifact: mergeSources(cur.artifact, sources) } : cur));
          },
          onResult: (artifact, model) => {
            setModelUsed(model);
            setStatus("done");
            setStages((cur) => cur.map((s) => ({ ...s, state: "done" })));
            setTask((cur) => {
              if (!cur) return cur;
              const title = artifact.title && artifact.title !== "Untitled" ? artifact.title : cur.title;
              const next: Task = { ...cur, artifact, title, state: "done", error: undefined, updatedAt: new Date().toISOString() };
              saveTask(next).catch(() => {});
              return next;
            });
            incrementBudget(FREE_DAILY_TASK_BUDGET).catch(() => {});
          },
          onError: (message) => {
            setError(message);
            setStatus("error");
            setStages((cur) => cur.map((s) => (s.state === "active" ? { ...s, state: "pending" } : s)));
            update({ state: "error", error: message }, { immediate: true });
          },
          onCancelled: () => {
            setStatus("cancelled");
            setStages((cur) => cur.map((s) => (s.state === "active" ? { ...s, state: "pending" } : s)));
            update({ state: "idle" }, { immediate: true });
          },
        }
      );
    },
    [serviceId, update]
  );

  const cancel = React.useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const retry = React.useCallback(() => run(), [run]);

  const refine = React.useCallback(
    (instruction: string) => {
      const current = taskRef.current;
      if (!current) return;
      run({ adjustments: { ...current.adjustments, instruction } });
    },
    [run]
  );

  React.useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  return {
    task,
    loaded,
    status,
    stages,
    error,
    coverage,
    modelUsed,
    update,
    run,
    cancel,
    retry,
    refine,
    setError,
  };
}

function insertStage(stages: Stage[], stage: Stage): Stage[] {
  const order: Stage["id"][] = ["received", "understanding", "sources", "drafting", "ready"];
  const next = [...stages, stage];
  return next.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
}

function mergeSources(artifact: Artifact | undefined, sources: Source[]): Artifact | undefined {
  if (!artifact) return artifact;
  const existing = artifact.sources ?? [];
  const ids = new Set(existing.map((s) => s.id));
  return { ...artifact, sources: [...existing, ...sources.filter((s) => !ids.has(s.id))] };
}

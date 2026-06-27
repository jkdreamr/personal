"use client";

import type { Adjustments, Artifact, Attachment, Source, Stage, VoiceProfile } from "@/lib/types";
import type { ServiceId } from "@/lib/services";

export type TaskEvents = {
  onStage?: (stage: Stage) => void;
  onSources?: (sources: Source[], coverage?: string) => void;
  onNotice?: (message: string) => void;
  onResult?: (artifact: Artifact, modelUsed: string) => void;
  onError?: (message: string) => void;
  onCancelled?: () => void;
};

export type RunTaskInput = {
  service: ServiceId;
  goal: string;
  attachments: Attachment[];
  adjustments: Adjustments;
  voiceProfile?: VoiceProfile | null;
};

/**
 * POST a task and consume the NDJSON stream, dispatching typed events.
 * Returns the AbortController so callers can cancel.
 */
export function runTaskStream(input: RunTaskInput, events: TaskEvents): AbortController {
  const controller = new AbortController();

  (async () => {
    let res: Response;
    try {
      res = await fetch("/api/task", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
        signal: controller.signal,
      });
    } catch {
      if (controller.signal.aborted) events.onCancelled?.();
      else events.onError?.("Harbor lost its connection. Your work is still saved here — try again.");
      return;
    }

    if (res.status === 401) {
      events.onError?.("Your private-beta session expired. Refresh the page to sign back in.");
      return;
    }
    if (!res.ok || !res.body) {
      events.onError?.("Something went wrong starting this task. Your work is still saved here.");
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buffer.indexOf("\n")) !== -1) {
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          if (!line) continue;
          dispatch(line, events);
        }
      }
      const tail = buffer.trim();
      if (tail) dispatch(tail, events);
    } catch {
      if (controller.signal.aborted) events.onCancelled?.();
      else events.onError?.("The connection was interrupted. Your work is still saved here — try again.");
    }
  })();

  return controller;
}

function dispatch(line: string, events: TaskEvents) {
  let msg: Record<string, unknown>;
  try {
    msg = JSON.parse(line);
  } catch {
    return;
  }
  switch (msg.type) {
    case "stage":
      events.onStage?.(msg.stage as Stage);
      break;
    case "sources":
      events.onSources?.(msg.sources as Source[], msg.coverage as string | undefined);
      break;
    case "notice":
      events.onNotice?.(msg.message as string);
      break;
    case "result":
      events.onResult?.(msg.artifact as Artifact, String(msg.modelUsed ?? ""));
      break;
    case "error":
      events.onError?.(msg.message as string);
      break;
    case "cancelled":
      events.onCancelled?.();
      break;
  }
}

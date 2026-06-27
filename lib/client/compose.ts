"use client";

import type { ComposeMode } from "@/lib/ai/compose-prompts";

export type ComposeInput = {
  mode: ComposeMode;
  goal?: string;
  context?: string;
  currentText?: string;
  selection?: string;
  instruction?: string;
  tone?: string;
  length?: string;
};

export type ComposeEvents = {
  onDelta: (text: string) => void;
  onDone?: () => void;
  onError?: (message: string) => void;
};

/** POST /api/compose and stream markdown deltas into the editor. Returns the controller. */
export function streamCompose(input: ComposeInput, events: ComposeEvents): AbortController {
  const controller = new AbortController();
  (async () => {
    let res: Response;
    try {
      res = await fetch("/api/compose", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
        signal: controller.signal,
      });
    } catch {
      if (!controller.signal.aborted) events.onError?.("Lost connection. Your text is safe — try again.");
      return;
    }
    if (!res.ok || !res.body) {
      events.onError?.(res.status === 401 ? "Your session expired — refresh the page." : "Couldn't start writing. Your text is safe — try again.");
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
          let msg: { type?: string; text?: string; message?: string };
          try {
            msg = JSON.parse(line);
          } catch {
            continue;
          }
          if (msg.type === "delta" && msg.text) events.onDelta(msg.text);
          else if (msg.type === "error") events.onError?.(msg.message || "Something went wrong.");
          else if (msg.type === "done") events.onDone?.();
        }
      }
      events.onDone?.();
    } catch {
      if (!controller.signal.aborted) events.onError?.("The connection was interrupted. Your text is safe — try again.");
    }
  })();
  return controller;
}

/** Optional ghost-text suggestion (single short continuation). Returns "" on any failure. */
export async function fetchGhost(paragraph: string, goal?: string, signal?: AbortSignal): Promise<string> {
  try {
    const res = await fetch("/api/autocomplete", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ paragraph, goal }),
      signal,
    });
    if (!res.ok) return "";
    const data = await res.json();
    return typeof data.suggestion === "string" ? data.suggestion : "";
  } catch {
    return "";
  }
}

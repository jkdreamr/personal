"use client";

import * as React from "react";
import type { Editor } from "@tiptap/react";
import { fetchGhost } from "@/lib/client/compose";
import { currentGhost } from "@/lib/richdoc/ghost-text";

/**
 * Drives cursor-anchored ghost autocomplete for a Tiptap editor: a short idle debounce plus a calm
 * heartbeat request a continuation for the current block up to the caret, then show it as a ghost
 * decoration. Stale requests are aborted; suggestions are suppressed during IME composition, text
 * selection, code/math nodes, and while disabled (e.g. another stream is running). Failures are
 * silent — autocomplete being unavailable never surfaces an error.
 */
export function useGhostText(editor: Editor | null, opts: { goal?: string; enabled: boolean }) {
  const ctl = React.useRef<AbortController | null>(null);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const enabledRef = React.useRef(opts.enabled);
  enabledRef.current = opts.enabled;
  const goalRef = React.useRef(opts.goal);
  goalRef.current = opts.goal;

  const request = React.useCallback(() => {
    if (!editor || !enabledRef.current || !editor.isEditable || editor.view.composing) return;
    const { selection } = editor.state;
    if (!selection.empty) return;
    if (editor.isActive("codeBlock") || editor.isActive("inlineMath") || editor.isActive("blockMath")) return;
    const blockStart = selection.$head.start();
    const before = editor.state.doc.textBetween(blockStart, selection.head, "\n", " ");
    if (before.trim().length < 12) return;

    ctl.current?.abort();
    const c = new AbortController();
    ctl.current = c;
    const headAtRequest = selection.head;
    fetchGhost(before, goalRef.current, c.signal)
      .then((s) => {
        if (c.signal.aborted || !s || !editor || editor.view.composing) return;
        // Only show if nothing moved/changed since the request was sent.
        if (!editor.state.selection.empty || editor.state.selection.head !== headAtRequest) return;
        editor.commands.setGhostText(/^\s/.test(s) ? s : " " + s);
      })
      .catch(() => {});
  }, [editor]);

  const schedule = React.useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(request, 650);
  }, [request]);

  React.useEffect(() => {
    if (!editor) return;
    const onUpdate = () => schedule(); // typing already cleared the ghost; queue a fresh one
    const onSelect = () => schedule();
    const onBlur = () => editor.commands.clearGhostText();
    editor.on("update", onUpdate);
    editor.on("selectionUpdate", onSelect);
    editor.on("blur", onBlur);
    // Keep offering a fresh continuation during sustained writing, without nagging.
    const heartbeat = setInterval(() => {
      if (editor.isFocused && !currentGhost(editor.state)) request();
    }, 9000);
    return () => {
      editor.off("update", onUpdate);
      editor.off("selectionUpdate", onSelect);
      editor.off("blur", onBlur);
      clearInterval(heartbeat);
      ctl.current?.abort();
      if (timer.current) clearTimeout(timer.current);
    };
  }, [editor, schedule, request]);
}

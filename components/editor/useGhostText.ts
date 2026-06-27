"use client";

import * as React from "react";
import type { Editor } from "@tiptap/react";
import { fetchGhost } from "@/lib/client/compose";

/**
 * Cursor-anchored ghost autocomplete — tuned to be quiet. It only offers a continuation at a natural
 * pause: when the caret is at the END of its block and the user has just finished a word (a trailing
 * space), with enough preceding context. It does NOT fire mid-word, on cursor moves, or on a periodic
 * timer — so it stops nagging — but a short debounce keeps it quick when a suggestion does make sense.
 * Suppressed during IME composition, selection, code/math nodes, blur, and while disabled. Stale
 * requests abort; failures are silent.
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

    const { $head, head } = selection;
    // Only when appending at the end of the current block (never mid-paragraph).
    if (head !== $head.end()) return;
    const before = editor.state.doc.textBetween($head.start(), head, "\n", " ");
    if (before.trim().length < 15) return;
    // Only right after a finished word — a trailing space — so it never interrupts mid-word and only
    // shows up at a sensible "what comes next" moment.
    if (!/\s$/.test(before)) return;

    ctl.current?.abort();
    const c = new AbortController();
    ctl.current = c;
    const headAtRequest = head;
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
    timer.current = setTimeout(request, 380);
  }, [request]);

  React.useEffect(() => {
    if (!editor) return;
    const onUpdate = () => schedule(); // only typing queues a suggestion; cursor moves do not
    const onBlur = () => editor.commands.clearGhostText();
    editor.on("update", onUpdate);
    editor.on("blur", onBlur);
    return () => {
      editor.off("update", onUpdate);
      editor.off("blur", onBlur);
      ctl.current?.abort();
      if (timer.current) clearTimeout(timer.current);
    };
  }, [editor, schedule]);
}

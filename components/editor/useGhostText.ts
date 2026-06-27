"use client";

import * as React from "react";
import type { Editor } from "@tiptap/react";
import { fetchGhost } from "@/lib/client/compose";
import { fitBeforeSuffix } from "@/lib/client/ghost-fit";

/**
 * Cursor-anchored ghost autocomplete — tuned to be quiet but to show up at natural pauses. It offers
 * a continuation when the user has just finished a word (a trailing space) with enough context, AND
 * is at one of two safe spots: the END of the block, or a sentence boundary mid-block (right after
 * ". "/"? "/"! "). In the mid-block case it's suffix-aware: the text after the caret is sent to the
 * model so the completion leads into it, and a completion that would collide with that text is
 * dropped. It never fires mid-word, on cursor moves, or on a timer. Suppressed during IME
 * composition, selection, code/math nodes, blur, and while disabled. Stale requests abort; failures
 * are silent.
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
    const before = editor.state.doc.textBetween($head.start(), head, "\n", " ");
    if (before.trim().length < 15) return;
    // Only right after a finished word — a trailing space — so it never interrupts mid-word and only
    // shows up at a sensible "what comes next" moment.
    if (!/\s$/.test(before)) return;

    const after = editor.state.doc.textBetween(head, $head.end(), "\n", " ");
    const atBlockEnd = head === $head.end(); // nothing after the caret in this block
    const atSentenceBoundary = /[.!?]\s+$/.test(before); // a natural pause between sentences
    // End of block → continue freely. Mid-block → only at a sentence boundary, and only with a
    // suffix the completion can lead into (suffix-aware). Otherwise stay quiet.
    if (!atBlockEnd && !atSentenceBoundary) return;
    const suffix = atBlockEnd ? "" : after.trim();

    ctl.current?.abort();
    const c = new AbortController();
    ctl.current = c;
    const headAtRequest = head;
    fetchGhost(before, { goal: goalRef.current, suffix: suffix || undefined }, c.signal)
      .then((s) => {
        if (c.signal.aborted || !s || !editor || editor.view.composing) return;
        // Only show if nothing moved/changed since the request was sent.
        if (!editor.state.selection.empty || editor.state.selection.head !== headAtRequest) return;
        if (suffix) {
          // Suffix-aware: make it safe to insert before the following text, or drop it.
          const fitted = fitBeforeSuffix(s, suffix);
          if (fitted) editor.commands.setGhostText(fitted);
        } else {
          editor.commands.setGhostText(/^\s/.test(s) ? s : " " + s);
        }
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

"use client";

import * as React from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import "katex/dist/katex.min.css";
import { richDocExtensions, fromProseMirrorDoc, toProseMirrorDoc, docToMarkdown, docToText, isDocEmpty, type RichDoc } from "@/lib/richdoc";
import { EditorToolbar } from "./EditorToolbar";
import { cn } from "@/lib/utils";

export type RichEditorChange = { doc: RichDoc; markdown: string; text: string; isEmpty: boolean };

/**
 * The canonical editable surface — one Tiptap editor used everywhere prose is written. Seeds from a
 * RichDoc, emits structured changes (doc + derived markdown/text), and hands the live editor instance
 * to the parent via `onReady` so it can drive streaming, Improve-selection, and autocomplete against
 * real document positions (not stale string indexes).
 */
export function RichDocumentEditor({
  initialDoc,
  editable = true,
  showToolbar = true,
  placeholder,
  ariaLabel = "Document editor",
  minHeightClass = "min-h-[280px]",
  className,
  autofocus = false,
  onChange,
  onReady,
}: {
  initialDoc?: RichDoc | null;
  editable?: boolean;
  showToolbar?: boolean;
  placeholder?: string;
  ariaLabel?: string;
  minHeightClass?: string;
  className?: string;
  autofocus?: boolean;
  onChange?: (change: RichEditorChange) => void;
  onReady?: (editor: Editor) => void;
}) {
  const changeTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const onChangeRef = React.useRef(onChange);
  onChangeRef.current = onChange;

  const emit = React.useCallback((editor: Editor) => {
    if (changeTimer.current) clearTimeout(changeTimer.current);
    changeTimer.current = setTimeout(() => {
      const pm = editor.getJSON() as { type: string; content?: RichDoc["content"] };
      const doc = fromProseMirrorDoc(pm);
      onChangeRef.current?.({ doc, markdown: docToMarkdown(doc), text: docToText(doc), isEmpty: isDocEmpty(doc) });
    }, 250);
  }, []);

  const editor = useEditor({
    extensions: richDocExtensions({ placeholder }),
    content: initialDoc ? toProseMirrorDoc(initialDoc) : "",
    editable,
    autofocus: autofocus ? "end" : false,
    // Avoid SSR hydration mismatches in the App Router.
    immediatelyRender: false,
    editorProps: {
      attributes: {
        role: "textbox",
        "aria-multiline": "true",
        "aria-label": ariaLabel,
        class: cn("px-3.5 py-3 focus:outline-none", minHeightClass),
      },
    },
    onUpdate: ({ editor }) => emit(editor),
  });

  React.useEffect(() => {
    if (editor) onReady?.(editor);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  React.useEffect(() => {
    if (editor && editor.isEditable !== editable) editor.setEditable(editable);
  }, [editor, editable]);

  React.useEffect(() => {
    return () => {
      if (changeTimer.current) clearTimeout(changeTimer.current);
    };
  }, []);

  return (
    <div className={cn("rich-editor", className)}>
      {editable && showToolbar && <EditorToolbar editor={editor} />}
      <div
        className={cn(
          "rounded-card border border-line bg-surface",
          editable && showToolbar && "rounded-t-none",
          !editable && "border-transparent bg-transparent"
        )}
      >
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

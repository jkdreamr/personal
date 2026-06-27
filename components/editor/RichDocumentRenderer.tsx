"use client";

import * as React from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import "katex/dist/katex.min.css";
import { RICHDOC_EXTENSIONS, toProseMirrorDoc, type RichDoc } from "@/lib/richdoc";
import { cn } from "@/lib/utils";

/**
 * Read-only render of a canonical document, using the SAME extension schema as the editor so math,
 * checklists, and formatting display identically to how they're edited. Used for the artifact read
 * view once a user has edited it into a rich document.
 */
export function RichDocumentRenderer({ doc, className }: { doc: RichDoc; className?: string }) {
  const editor = useEditor({
    extensions: RICHDOC_EXTENSIONS,
    content: toProseMirrorDoc(doc),
    editable: false,
    immediatelyRender: false,
    editorProps: { attributes: { class: "focus:outline-none" } },
  });

  // Keep the rendered content in sync if the document changes (e.g. after an edit elsewhere).
  React.useEffect(() => {
    if (editor) editor.commands.setContent(toProseMirrorDoc(doc), { emitUpdate: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc, editor]);

  // No `print-document` here — this renders INSIDE ArtifactBody's print-document article; a nested
  // one would inherit the print absolute-positioning and break the printed layout.
  return (
    <div className={cn("rich-editor", className)}>
      <EditorContent editor={editor} />
    </div>
  );
}

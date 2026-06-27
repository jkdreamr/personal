"use client";

import * as React from "react";
import { FileText, Image as ImageIcon, Link2, ClipboardPaste, RotateCcw } from "lucide-react";
import type { Attachment } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/primitives";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";

function kindIcon(a: Attachment) {
  if (a.kind === "link") return Link2;
  if (a.kind === "text") return ClipboardPaste;
  if (a.mime?.startsWith("image/") || a.meta?.previewDataUrl) return ImageIcon;
  return FileText;
}

function sourceLabel(a: Attachment): string {
  if (a.kind === "link") return "Link — fetched when you run";
  if (a.kind === "text") return "Pasted text";
  if (a.meta?.corrected) return "Manually corrected";
  if (a.meta?.ocr) return `Read by OCR${a.meta.ocrConfidence != null ? ` · ${Math.round(a.meta.ocrConfidence * 100)}% confidence` : ""}`;
  return "Extracted text";
}

function bytesLabel(n?: number): string | null {
  if (!n) return null;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * View and edit any piece of context. Pasted text and extracted/OCR'd file text are editable here —
 * saving updates the context Harbor uses for generation, suggestions, and autocomplete, all locally.
 * The original raw extraction is preserved so an edit can always be reverted.
 */
export function AttachmentViewer({
  attachment,
  onSave,
  onClose,
}: {
  attachment: Attachment;
  onSave: (next: Attachment) => void;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [text, setText] = React.useState(attachment.text);
  const Icon = kindIcon(attachment);
  const isImage = Boolean(attachment.meta?.previewDataUrl);
  const isLink = attachment.kind === "link";
  const editable = !isLink;
  const dirty = text !== attachment.text;
  const meta = attachment.meta ?? {};
  const metaBits = [meta.url, attachment.mime, bytesLabel(meta.bytes), meta.pages ? `${meta.pages} pages` : null].filter(Boolean) as string[];

  const save = () => {
    const next: Attachment = {
      ...attachment,
      text,
      meta: {
        ...meta,
        // Keep the original extraction the first time the user edits.
        rawText: meta.rawText ?? (meta.corrected ? meta.rawText : attachment.text),
        corrected: editable ? true : meta.corrected,
        lowConfidence: false, // the user has reviewed it
      },
    };
    onSave(next);
    toast({ title: "Context updated.", tone: "success" });
    onClose();
  };

  const resetToOriginal = () => {
    if (meta.rawText != null) setText(meta.rawText);
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto">
        <div className="flex items-start gap-2.5">
          <Icon className="mt-0.5 h-5 w-5 shrink-0 text-muted" />
          <div className="min-w-0">
            <DialogTitle className="truncate">{attachment.label}</DialogTitle>
            <DialogDescription className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <Badge tone={meta.corrected ? "success" : meta.lowConfidence ? "warning" : "neutral"}>{sourceLabel(attachment)}</Badge>
              {metaBits.length > 0 && <span className="text-meta text-muted">{metaBits.join(" · ")}</span>}
            </DialogDescription>
          </div>
        </div>

        {meta.error && (
          <p className="mt-3 rounded-card border border-warning/30 bg-warning/[0.06] p-2.5 text-sm text-ink/85">{meta.error}</p>
        )}

        {isImage && meta.previewDataUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={meta.previewDataUrl} alt={`Preview of ${attachment.label}`} className="mt-3 max-h-40 w-auto rounded-card border border-line object-contain" />
        )}

        {isLink ? (
          <p className="mt-3 text-sm text-ink/80">
            Harbor fetches this page through its safe, server-side reader when you run — it isn’t loaded now, so there’s nothing to edit yet.
          </p>
        ) : (
          <div className="mt-3">
            <div className="mb-1 flex items-center justify-between">
              <label htmlFor="att-text" className="text-meta text-muted">
                {meta.ocr ? "Extracted text — correct anything the OCR misread" : "Text Harbor will use — edit it freely"}
              </label>
              {meta.rawText != null && dirty && (
                <button onClick={resetToOriginal} className="inline-flex items-center gap-1 text-meta text-muted underline underline-offset-2 hover:text-ink">
                  <RotateCcw className="h-3.5 w-3.5" /> Reset to original
                </button>
              )}
            </div>
            <textarea
              id="att-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={8}
              spellCheck
              className="max-h-[38vh] w-full resize-y rounded-card border border-line bg-surface px-3 py-2.5 font-sans text-sm leading-relaxed text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/70"
            />
            <p className="mt-1 text-meta text-muted tnum">{text.trim() ? text.trim().split(/\s+/).length : 0} words</p>
          </div>
        )}

        <div className="mt-4 flex items-center justify-end gap-2">
          <button onClick={onClose} className="text-meta text-muted underline underline-offset-2 hover:text-ink">
            Close
          </button>
          {editable && (
            <Button size="sm" onClick={save} disabled={!dirty}>
              Save changes
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

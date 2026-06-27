"use client";

import * as React from "react";
import { FileText, Image as ImageIcon, Link2, ClipboardPaste, X } from "lucide-react";
import type { Attachment } from "@/lib/types";
import { AttachmentViewer } from "./AttachmentViewer";
import { cn } from "@/lib/utils";

function icon(a: Attachment) {
  if (a.kind === "link") return Link2;
  if (a.kind === "text") return ClipboardPaste;
  if (a.mime?.startsWith("image/") || a.meta?.previewDataUrl) return ImageIcon;
  return FileText;
}

/**
 * The list of added context items. Each row opens an accessible viewer where the user can read and —
 * for pasted text and extracted/OCR'd files — edit the content; saving updates the context. No
 * re-upload is ever required to inspect or correct a source.
 */
export function AttachmentList({
  attachments,
  onChange,
  className,
}: {
  attachments: Attachment[];
  onChange: (next: Attachment[]) => void;
  className?: string;
}) {
  const [viewing, setViewing] = React.useState<string | null>(null);
  const active = attachments.find((a) => a.id === viewing) ?? null;

  if (attachments.length === 0) return null;

  return (
    <>
      <ul className={cn("space-y-1.5", className)}>
        {attachments.map((a) => {
          const Icon = icon(a);
          return (
            <li key={a.id} className="flex items-center rounded-btn border border-line bg-canvas text-meta">
              <button
                type="button"
                onClick={() => setViewing(a.id)}
                aria-label={`View and edit ${a.label}`}
                className="flex min-w-0 flex-1 items-center gap-2 px-2.5 py-1.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/70"
              >
                <Icon className="h-3.5 w-3.5 shrink-0 text-muted" />
                <span className="truncate text-ink/85">{a.label}</span>
                {a.meta?.lowConfidence && !a.meta?.corrected && (
                  <span className="shrink-0 rounded-chip border border-warning/30 bg-warning/[0.06] px-1.5 text-warning">check</span>
                )}
              </button>
              <button
                type="button"
                aria-label={`Remove ${a.label}`}
                onClick={() => onChange(attachments.filter((x) => x.id !== a.id))}
                className="px-2 py-1.5 text-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/70"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          );
        })}
      </ul>
      {active && (
        <AttachmentViewer
          attachment={active}
          onSave={(next) => onChange(attachments.map((x) => (x.id === next.id ? next : x)))}
          onClose={() => setViewing(null)}
        />
      )}
    </>
  );
}

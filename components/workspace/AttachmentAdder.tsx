"use client";

import * as React from "react";
import { ClipboardPaste, Upload, Link2, Loader2 } from "lucide-react";
import type { Attachment } from "@/lib/types";
import { uid } from "@/lib/utils";
import { extractFile, ACCEPTED_ACCEPT_ATTR } from "@/lib/files/extract";
import { validateUrlShape } from "@/lib/research/url-shape";
import { MAX_ATTACHMENTS, MAX_FILE_BYTES } from "@/lib/client/config";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Label } from "@/components/ui/field";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";

export function AttachmentAdder({
  attachments,
  onChange,
  acceptsFiles = true,
  acceptsLinks = true,
  compact = false,
}: {
  attachments: Attachment[];
  onChange: (next: Attachment[]) => void;
  acceptsFiles?: boolean;
  acceptsLinks?: boolean;
  compact?: boolean;
}) {
  const { toast } = useToast();
  const fileInput = React.useRef<HTMLInputElement>(null);
  const [pasteOpen, setPasteOpen] = React.useState(false);
  const [linkOpen, setLinkOpen] = React.useState(false);
  const [pasteText, setPasteText] = React.useState("");
  const [linkUrl, setLinkUrl] = React.useState("");
  const [busy, setBusy] = React.useState<string | null>(null);

  const atLimit = attachments.length >= MAX_ATTACHMENTS;

  const add = (att: Attachment) => onChange([...attachments, att]);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    let current = [...attachments];
    for (const file of Array.from(files)) {
      if (current.length >= MAX_ATTACHMENTS) {
        toast({ title: `You can attach up to ${MAX_ATTACHMENTS} items.`, tone: "neutral" });
        break;
      }
      setBusy(file.name);
      try {
        const { attachment } = await extractFile(file, MAX_FILE_BYTES, () => {});
        current = [...current, attachment];
        onChange(current);
      } catch (err) {
        toast({ title: "Couldn't read that file", description: err instanceof Error ? err.message : undefined, tone: "danger" });
      } finally {
        setBusy(null);
      }
    }
    if (fileInput.current) fileInput.current.value = "";
  };

  const addPaste = () => {
    const text = pasteText.trim();
    if (!text) return;
    add({ id: uid("att"), kind: "text", label: "Pasted text", text });
    setPasteText("");
    setPasteOpen(false);
  };

  const addLink = () => {
    const v = validateUrlShape(linkUrl);
    if (!v.ok) {
      toast({ title: "That link can't be used", description: v.reason, tone: "danger" });
      return;
    }
    add({ id: uid("att"), kind: "link", label: v.url.hostname.replace(/^www\./, "") + v.url.pathname, text: "", meta: { url: v.url.toString() } });
    setLinkUrl("");
    setLinkOpen(false);
  };

  const btn = compact ? "sm" : "md";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" variant="secondary" size={btn} onClick={() => setPasteOpen(true)} disabled={atLimit}>
        <ClipboardPaste className="h-4 w-4" /> Paste text
      </Button>
      {acceptsFiles && (
        <Button type="button" variant="secondary" size={btn} onClick={() => fileInput.current?.click()} disabled={atLimit || !!busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {busy ? `Reading ${busy.slice(0, 16)}…` : "Upload files"}
        </Button>
      )}
      {acceptsLinks && (
        <Button type="button" variant="secondary" size={btn} onClick={() => setLinkOpen(true)} disabled={atLimit}>
          <Link2 className="h-4 w-4" /> Add a link
        </Button>
      )}

      <input
        ref={fileInput}
        type="file"
        multiple
        accept={ACCEPTED_ACCEPT_ATTR}
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      <Dialog open={pasteOpen} onOpenChange={setPasteOpen}>
        <DialogContent>
          <DialogTitle>Paste text</DialogTitle>
          <DialogDescription>An email thread, notes, a document — whatever you have.</DialogDescription>
          <Textarea
            autoFocus
            className="mt-3 min-h-[200px]"
            placeholder="Paste here…"
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
          />
          <div className="mt-3 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setPasteOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={addPaste} disabled={!pasteText.trim()}>
              Add text
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
        <DialogContent>
          <DialogTitle>Add a public link</DialogTitle>
          <DialogDescription>Harbor reads only public pages — never anything behind a login.</DialogDescription>
          <div className="mt-3">
            <Label htmlFor="harbor-link">Web address</Label>
            <Input
              id="harbor-link"
              autoFocus
              className="mt-1.5"
              placeholder="https://example.com"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addLink()}
            />
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setLinkOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={addLink} disabled={!linkUrl.trim()}>
              Add link
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

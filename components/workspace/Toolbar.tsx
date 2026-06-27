"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Copy, Download, Printer, Files, Plus, Shield, MoreHorizontal, Check } from "lucide-react";
import type { Artifact } from "@/lib/types";
import type { ServiceId } from "@/lib/services";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/overlays";
import { useToast } from "@/components/ui/toast";
import {
  copyToClipboard,
  exportArtifact,
  copyHelpers,
  type ExportFormat,
} from "@/lib/client/download";
import { comparisonToTsv } from "@/lib/export/csv";
import { TRUST_TIER_LABELS } from "@/lib/research/trust-tier";

function MenuItem({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center justify-between gap-2 rounded-btn px-2.5 py-2 text-left text-sm text-ink hover:bg-ink/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/70"
    >
      {children}
    </button>
  );
}

export function Toolbar({
  service,
  artifact,
  editedBody,
  taskId,
  onDuplicate,
}: {
  service: ServiceId;
  artifact: Artifact;
  editedBody?: string;
  taskId: string;
  onDuplicate: () => void;
}) {
  const { toast } = useToast();
  const router = useRouter();
  const [copyOpen, setCopyOpen] = React.useState(false);
  const [exportOpen, setExportOpen] = React.useState(false);
  const [moreOpen, setMoreOpen] = React.useState(false);

  const doCopy = async (label: string, text: string | null) => {
    if (!text) {
      toast({ title: "Nothing to copy for this.", tone: "neutral" });
      return;
    }
    const ok = await copyToClipboard(text);
    toast({ title: ok ? `${label} copied to clipboard.` : "Couldn't copy — try selecting the text.", tone: ok ? "success" : "danger" });
    setCopyOpen(false);
  };

  const doExport = (label: string, format: ExportFormat) => {
    const name = exportArtifact(service, artifact, format, editedBody);
    if (name) toast({ title: "Exported", description: name, tone: "success" });
    else toast({ title: "That export isn't available here.", tone: "neutral" });
    setExportOpen(false);
  };

  const citations = () =>
    (artifact.sources ?? [])
      .map((s) => `${s.title}${s.canonicalUrl ? ` — ${s.canonicalUrl}` : ""} (${TRUST_TIER_LABELS[s.trustTier]}, retrieved ${s.retrievedAt.slice(0, 10)})`)
      .join("\n");

  const slideOutline = () =>
    (artifact.slides ?? []).map((s, i) => `${i + 1}. ${s.title} — ${s.message}`).join("\n");
  const speakerNotes = () =>
    (artifact.slides ?? []).map((s, i) => `Slide ${i + 1}: ${s.title}\n${s.speakerNotes ?? ""}`).join("\n\n");

  return (
    <div className="flex items-center gap-1.5">
      {/* Copy */}
      <Popover open={copyOpen} onOpenChange={setCopyOpen}>
        <PopoverTrigger asChild>
          <Button variant="secondary" size="sm">
            <Copy className="h-4 w-4" /> Copy
          </Button>
        </PopoverTrigger>
        <PopoverContent>
          <MenuItem onClick={() => doCopy("Full result", copyHelpers.artifactToMarkdown(artifact, { editedBody }))}>Copy full result</MenuItem>
          <MenuItem onClick={() => doCopy("Clean text", copyHelpers.artifactToText(artifact, { editedBody }))}>Copy clean text</MenuItem>
          <MenuItem onClick={() => doCopy("Markdown", copyHelpers.artifactToMarkdown(artifact, { editedBody }))}>Copy as Markdown</MenuItem>
          {artifact.email && <MenuItem onClick={() => doCopy("Email", copyHelpers.emailToText(artifact))}>Copy email-ready version</MenuItem>}
          {artifact.slides?.length ? <MenuItem onClick={() => doCopy("Slide outline", slideOutline())}>Copy slide outline</MenuItem> : null}
          {artifact.slides?.length ? <MenuItem onClick={() => doCopy("Speaker notes", speakerNotes())}>Copy speaker notes</MenuItem> : null}
          {artifact.comparison && <MenuItem onClick={() => doCopy("Table", comparisonToTsv(artifact.comparison!))}>Copy table (TSV)</MenuItem>}
          {artifact.sources?.length ? <MenuItem onClick={() => doCopy("Citations", citations())}>Copy source citations</MenuItem> : null}
        </PopoverContent>
      </Popover>

      {/* Export */}
      <Popover open={exportOpen} onOpenChange={setExportOpen}>
        <PopoverTrigger asChild>
          <Button variant="secondary" size="sm">
            <Download className="h-4 w-4" /> Export
          </Button>
        </PopoverTrigger>
        <PopoverContent>
          <MenuItem onClick={() => doExport("Markdown", "markdown")}>Markdown (.md)</MenuItem>
          <MenuItem onClick={() => doExport("Text", "text")}>Plain text (.txt)</MenuItem>
          <MenuItem onClick={() => window.print()}>Print / Save as PDF</MenuItem>
          {(artifact.claims?.length || artifact.sources?.length) && (
            <MenuItem onClick={() => doExport("Evidence", "json")}>Evidence package (.json)</MenuItem>
          )}
          {artifact.comparison && <MenuItem onClick={() => doExport("CSV", "csv")}>Comparison (.csv)</MenuItem>}
          {artifact.comparison && <MenuItem onClick={() => doExport("TSV", "tsv")}>Comparison (.tsv)</MenuItem>}
        </PopoverContent>
      </Popover>

      {/* Less-used actions live in one quiet overflow on every screen size. */}
      <Popover open={moreOpen} onOpenChange={setMoreOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" aria-label="More actions">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent>
          <MenuItem onClick={() => { window.print(); setMoreOpen(false); }}>
            <span className="inline-flex items-center gap-2"><Printer className="h-4 w-4" /> Print / Save as PDF</span>
          </MenuItem>
          <MenuItem onClick={() => { onDuplicate(); setMoreOpen(false); }}>
            <span className="inline-flex items-center gap-2"><Files className="h-4 w-4" /> Duplicate</span>
          </MenuItem>
          <MenuItem onClick={() => { router.push(`/${service}`); setMoreOpen(false); }}>
            <span className="inline-flex items-center gap-2"><Plus className="h-4 w-4" /> Start new</span>
          </MenuItem>
        </PopoverContent>
      </Popover>

      {/* Privacy */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" aria-label="Privacy">
            <Shield className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72">
          <div className="space-y-2 p-1.5 text-sm">
            <p className="flex items-center gap-1.5 font-semibold text-ink">
              <Check className="h-3.5 w-3.5 text-success" /> Your work stays in this browser
            </p>
            <p className="text-ink/75">
              Harbor saves your work locally and only sends text to the model when you run a task. It never sells your content.
            </p>
            <p className="text-meta text-muted">
              This is a private beta using free third-party providers. Don&apos;t upload confidential or sensitive material.
            </p>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

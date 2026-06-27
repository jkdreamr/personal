"use client";

import type { Artifact } from "@/lib/types";
import type { ServiceId } from "@/lib/services";
import { artifactToMarkdown } from "@/lib/export/markdown";
import { artifactToText, emailToText } from "@/lib/export/text";
import { comparisonToCsv, comparisonToTsv } from "@/lib/export/csv";
import { evidencePackageToJson } from "@/lib/export/json-evidence";
import { exportFilename } from "@/lib/export/filename";

/** Trigger a browser download from a string. Returns true only if it actually ran. */
export function downloadText(filename: string, content: string, mime = "text/plain"): boolean {
  try {
    const blob = new Blob([content], { type: `${mime};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  } catch {
    return false;
  }
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to legacy path */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

export type ExportFormat = "markdown" | "text" | "json" | "csv" | "tsv";

/** Returns the filename written, or null if the format wasn't applicable / failed. */
export function exportArtifact(
  service: ServiceId,
  artifact: Artifact,
  format: ExportFormat,
  editedBody?: string
): string | null {
  switch (format) {
    case "markdown": {
      const name = exportFilename(service, artifact.title, "md");
      return downloadText(name, artifactToMarkdown(artifact, { editedBody }), "text/markdown") ? name : null;
    }
    case "text": {
      const name = exportFilename(service, artifact.title, "txt");
      return downloadText(name, artifactToText(artifact, { editedBody }), "text/plain") ? name : null;
    }
    case "json": {
      const name = exportFilename(service, artifact.title, "json");
      return downloadText(name, evidencePackageToJson(artifact), "application/json") ? name : null;
    }
    case "csv": {
      if (!artifact.comparison) return null;
      const name = exportFilename(service, artifact.title, "csv");
      return downloadText(name, comparisonToCsv(artifact.comparison), "text/csv") ? name : null;
    }
    case "tsv": {
      if (!artifact.comparison) return null;
      const name = exportFilename(service, artifact.title, "tsv");
      return downloadText(name, comparisonToTsv(artifact.comparison), "text/tab-separated-values") ? name : null;
    }
  }
}

export const copyHelpers = { artifactToMarkdown, artifactToText, emailToText };

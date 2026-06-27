import type { Artifact } from "@/lib/types";
import { artifactToMarkdown } from "./markdown";

/** Plain text export: strip lightweight markdown markers from the markdown render. */
export function artifactToText(artifact: Artifact, opts?: { editedBody?: string }): string {
  const md = artifactToMarkdown(artifact, opts);
  return md
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/(^|\s)_([^_]+)_(\s|$)/g, "$1$2$3")
    .replace(/^>\s?/gm, "")
    .replace(/^\|.*\|$/gm, (line) => line.replace(/\|/g, " ").replace(/\s{2,}/g, "  ").trim())
    .replace(/\n{3,}/g, "\n\n")
    .trim() + "\n";
}

/** Email-ready text: subject + body only. */
export function emailToText(artifact: Artifact): string | null {
  if (!artifact.email) return null;
  const subject = artifact.email.subjectOptions[0] ?? "";
  return `Subject: ${subject}\n\n${artifact.email.body}`.trim() + "\n";
}

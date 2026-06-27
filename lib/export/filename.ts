import type { ServiceId } from "@/lib/services";

/** Slugify a title into a clean filename fragment. */
export function slugify(input: string, max = 48): string {
  const s = input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return (s || "untitled").slice(0, max).replace(/-$/, "");
}

/** YYYY-MM-DD in local time. */
export function dateStamp(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const SERVICE_NOUN: Record<ServiceId, string> = {
  write: "draft",
  notes: "notes",
  present: "presentation",
  proposal: "proposal",
  research: "brief",
  challenge: "challenge",
  verify: "verify",
  compare: "comparison",
  brief: "brief",
  meeting: "meeting-prep",
  decide: "decision",
  explain: "explainer",
};

/** e.g. harbor-meeting-prep-acme-2026-06-26.md */
export function exportFilename(service: ServiceId, title: string, ext: string, date = new Date()): string {
  const noun = SERVICE_NOUN[service] ?? service;
  return `harbor-${noun}-${slugify(title)}-${dateStamp(date)}.${ext}`;
}

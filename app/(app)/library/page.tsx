"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { Upload, Download, Trash2, Files, FileDown, Search } from "lucide-react";
import {
  listTasks,
  deleteTask,
  duplicateTask,
  saveTask,
  exportAll,
  importAll,
  type HarborBackup,
} from "@/lib/db/tasks";
import { SERVICES, SERVICE_GROUPS, type ServiceGroup } from "@/lib/services";
import { relativeTime, truncate } from "@/lib/utils";
import { exportArtifact, downloadText } from "@/lib/client/download";
import { dateStamp } from "@/lib/export/filename";
import { ServiceIcon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";

export default function LibraryPage() {
  const router = useRouter();
  const { toast } = useToast();
  const tasks = useLiveQuery(() => listTasks(), [], undefined);
  const [filter, setFilter] = React.useState<ServiceGroup | "all">("all");
  const [query, setQuery] = React.useState("");
  const fileRef = React.useRef<HTMLInputElement>(null);

  const filtered = (tasks ?? []).filter((t) => {
    if (filter !== "all" && SERVICES[t.service].group !== filter) return false;
    if (query.trim()) {
      const hay = `${t.title} ${t.goal} ${t.artifact?.summary ?? ""}`.toLowerCase();
      if (!hay.includes(query.toLowerCase())) return false;
    }
    return true;
  });

  const onDelete = async (id: string, title: string) => {
    const removed = await deleteTask(id);
    toast({
      title: "Deleted",
      description: truncate(title, 40),
      tone: "neutral",
      action: removed
        ? {
            label: "Undo",
            onClick: () => saveTask(removed).then(() => toast({ title: "Restored." })),
          }
        : undefined,
    });
  };

  const onExportAll = async () => {
    const backup = await exportAll();
    const name = `harbor-backup-${dateStamp()}.json`;
    const ok = downloadText(name, JSON.stringify(backup, null, 2), "application/json");
    toast(ok ? { title: "Backup saved", description: name, tone: "success" } : { title: "Couldn't export.", tone: "danger" });
  };

  const onImport = async (file: File | undefined) => {
    if (!file) return;
    try {
      const backup = JSON.parse(await file.text()) as HarborBackup;
      const { tasks: n } = await importAll(backup);
      toast({ title: "Imported", description: `${n} item${n === 1 ? "" : "s"} added.`, tone: "success" });
    } catch (err) {
      toast({ title: "Couldn't import that file", description: err instanceof Error ? err.message : undefined, tone: "danger" });
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="mx-auto max-w-3xl px-5 py-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold text-ink">Library</h1>
          <p className="mt-1 text-sm text-muted">Everything you&apos;ve made stays in this browser until you export it.</p>
        </div>
        <div className="flex gap-2">
          <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => onImport(e.target.files?.[0])} />
          <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>
            <Upload className="h-4 w-4" /> Import
          </Button>
          <Button variant="secondary" size="sm" onClick={onExportAll}>
            <Download className="h-4 w-4" /> Export all
          </Button>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input className="pl-9" placeholder="Search your work…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div className="flex gap-1.5">
          {(["all", ...SERVICE_GROUPS.map((g) => g.id)] as const).map((g) => (
            <button
              key={g}
              onClick={() => setFilter(g)}
              className={`rounded-chip border px-2.5 py-1.5 text-meta font-medium capitalize ${
                filter === g ? "border-ink bg-ink text-canvas" : "border-line bg-surface text-ink/70 hover:bg-ink/[0.05]"
              }`}
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5">
        {tasks === undefined ? null : filtered.length === 0 ? (
          <div className="rounded-card border border-dashed border-line bg-surface/40 p-8 text-center">
            <p className="text-sm text-muted">
              {tasks.length === 0 ? "No saved work yet." : "Nothing matches that filter."} Anything you make in Harbor will appear here.
            </p>
            <Link href="/" className="mt-3 inline-block text-sm font-medium text-ink underline underline-offset-2">
              Start something
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-card border border-line">
            {filtered.map((t) => {
              const svc = SERVICES[t.service];
              return (
                <li key={t.id} className="bg-canvas">
                  <div className="flex items-center gap-3 px-4 py-3">
                    <Link
                      href={`/${t.service}?task=${t.id}`}
                      className="flex min-w-0 flex-1 items-center gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/70 rounded"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-btn border border-line bg-surface">
                        <ServiceIcon name={svc.icon} className="h-4 w-4 text-ink/70" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-ink">{t.title || "Untitled"}</span>
                        <span className="block truncate text-meta text-muted">
                          {svc.label} · {relativeTime(t.updatedAt)}
                          {t.artifact?.summary ? ` · ${truncate(t.artifact.summary, 60)}` : ""}
                        </span>
                      </span>
                    </Link>
                    <div className="flex shrink-0 items-center gap-0.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label="Duplicate"
                        onClick={async () => {
                          const c = await duplicateTask(t.id);
                          if (c) toast({ title: "Duplicated." });
                        }}
                      >
                        <Files className="h-4 w-4" />
                      </Button>
                      {t.artifact && (
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label="Export markdown"
                          onClick={() => {
                            const name = exportArtifact(t.service, t.artifact!, "markdown", t.editedBody);
                            toast(name ? { title: "Exported", description: name, tone: "success" } : { title: "Couldn't export.", tone: "danger" });
                          }}
                        >
                          <FileDown className="h-4 w-4" />
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" aria-label="Delete" className="text-danger" onClick={() => onDelete(t.id, t.title)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

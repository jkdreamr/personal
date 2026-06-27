"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { listTasks } from "@/lib/db/tasks";
import { SERVICES } from "@/lib/services";
import { relativeTime, truncate } from "@/lib/utils";
import { ServiceIcon } from "@/components/ui/icon";
import { Eyebrow } from "@/components/ui/primitives";

export function RecentWork() {
  const tasks = useLiveQuery(() => listTasks(), [], undefined);

  if (tasks === undefined) return null; // loading; avoid layout flash

  if (tasks.length === 0) {
    return (
      <section>
        <Eyebrow>Recent work</Eyebrow>
        <div className="mt-3 rounded-card border border-dashed border-line bg-surface/40 p-5 text-sm text-muted">
          Your saved work will appear here. Nothing leaves this browser unless you export it.
        </div>
      </section>
    );
  }

  return (
    <section>
      <div className="flex items-center justify-between">
        <Eyebrow>Recent work</Eyebrow>
        <Link href="/library" className="text-meta text-muted underline underline-offset-2 hover:text-ink">
          View all
        </Link>
      </div>
      <ul className="mt-3 divide-y divide-line overflow-hidden rounded-card border border-line">
        {tasks.slice(0, 5).map((t) => {
          const svc = SERVICES[t.service];
          return (
            <li key={t.id}>
              <Link
                href={`/${t.service}?task=${t.id}`}
                className="flex items-center gap-3 bg-canvas px-4 py-3 hover:bg-ink/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/70"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-btn border border-line bg-surface">
                  <ServiceIcon name={svc.icon} className="h-4 w-4 text-ink/70" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-ink">{t.title || "Untitled"}</span>
                  <span className="block truncate text-meta text-muted">
                    {svc.label}
                    {t.artifact?.summary ? ` · ${truncate(t.artifact.summary, 70)}` : ""}
                  </span>
                </span>
                <span className="shrink-0 text-meta text-muted">{relativeTime(t.updatedAt)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

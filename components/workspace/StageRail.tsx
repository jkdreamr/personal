"use client";

import { Check, Loader2 } from "lucide-react";
import type { Stage } from "@/lib/types";
import { cn } from "@/lib/utils";

/** A real, execution-driven stage rail. No fake "thinking" prose. aria-live announces changes. */
export function StageRail({ stages }: { stages: Stage[] }) {
  const active = stages.find((s) => s.state === "active");
  return (
    <div className="rounded-card border border-line bg-canvas p-4">
      <p className="sr-only" aria-live="polite">
        {active ? active.label : "Working"}
      </p>
      <ol className="space-y-2.5">
        {stages.map((s) => (
          <li key={s.id} className="flex items-center gap-2.5 text-sm">
            <span
              className={cn(
                "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                s.state === "done" && "border-ink bg-ink text-canvas",
                s.state === "active" && "border-ink text-ink",
                s.state === "pending" && "border-line text-muted"
              )}
            >
              {s.state === "done" ? (
                <Check className="h-3 w-3" strokeWidth={2.5} />
              ) : s.state === "active" ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
              )}
            </span>
            <span className={cn(s.state === "pending" ? "text-muted" : "text-ink", s.state === "active" && "font-medium")}>
              {s.label}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

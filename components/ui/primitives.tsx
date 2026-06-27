"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-card border border-line bg-canvas", className)} {...props} />;
}

type BadgeTone = "neutral" | "success" | "warning" | "danger" | "primary" | "info";

const badgeTones: Record<BadgeTone, string> = {
  neutral: "bg-surface text-ink/80 border-line",
  primary: "bg-ink/[0.07] text-ink border-ink/15",
  success: "bg-success/10 text-success border-success/25",
  warning: "bg-warning/10 text-warning border-warning/30",
  danger: "bg-danger/10 text-danger border-danger/30",
  info: "bg-muted/15 text-ink/80 border-muted/30",
};

export function Badge({
  tone = "neutral",
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-chip border px-2 py-0.5 text-meta font-medium",
        badgeTones[tone],
        className
      )}
      {...props}
    />
  );
}

export function Divider({ className }: { className?: string }) {
  return <hr className={cn("border-0 border-t border-line", className)} />;
}

/** Small section eyebrow label used across panels. */
export function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn("text-meta font-semibold uppercase tracking-wide text-muted", className)}>{children}</p>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn("inline-block h-4 w-4 animate-spin rounded-full border-2 border-ink/30 border-t-ink", className)}
      role="status"
      aria-label="Working"
    />
  );
}

/** Skeleton block for loading states. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-ink/[0.06]", className)} aria-hidden />;
}

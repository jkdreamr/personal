"use client";

import { cn } from "@/lib/utils";

export type SegmentedOption<T extends string> = { value: T; label: string; badge?: number };

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
  "aria-label": ariaLabel,
}: {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn("inline-flex items-center gap-1 rounded-btn border border-line bg-surface p-1", className)}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-[6px] px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/70",
              active ? "bg-canvas text-ink shadow-card" : "text-ink/60 hover:text-ink"
            )}
          >
            {opt.label}
            {typeof opt.badge === "number" && opt.badge > 0 && (
              <span className="rounded-full bg-ink/[0.08] px-1.5 text-meta text-ink/70 tnum">{opt.badge}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

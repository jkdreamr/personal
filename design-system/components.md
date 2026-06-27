# Harbor — Components

Hand-built on Radix primitives. One consistent visual language. No default shadcn look.

## Primitives (`components/ui`)
- **Button**: variants `primary` (ink fill, canvas text), `secondary` (surface fill, ink text,
  thin border), `ghost` (transparent, ink), `danger` (danger border/text, fill on confirm).
  Sizes sm/md/lg, all ≥44px touch height at md. Loading state disables + shows inline spinner.
- **Input / Textarea**: surface fill, 1px ink/12% border, ink text, muted placeholder, 2px focus
  ring. Always paired with a visible `<label>`.
- **Card**: canvas/surface, 1px ink/10% border, 10px radius, optional restrained shadow only when
  elevated.
- **Badge / Chip**: small, surface fill, used for context types, trust tiers, claim labels, the
  "Demo example" tag. Each carries text (never color-only).
- **Dialog / Popover / Tooltip / Tabs / Toast** (Radix): ink-on-surface, soft shadow for overlays,
  scrim 45% for dialogs, focus trapped, Escape closes, `aria-live` for toasts.
- **SegmentedControl**: mobile Context|Work|Sources and small option switches.
- **StageRail**: vertical list of real stages with done/active/pending states (icon + label, not
  color alone).

## Domain components (`components/workspace`)
- **SourceChip + SourceSheet**: chip under factual claims; opens a sheet with title, publisher,
  canonical URL, trust tier, retrieval time, exact excerpt.
- **ClaimCard**: claim text + classification label (Verified fact / Reported claim / Opinion /
  Unresolved question / Not sufficiently supported) + confidence + supporting excerpts.
- **SlideDeck + SlideView**: editorial layouts (Cover, Thesis, Problem, Insight, Timeline,
  Comparison, Framework, Recommendation, Closing). Large statements, whitespace, minimal copy.
- **ComparisonTable**: responsive; becomes stacked cards on mobile; CSV/TSV copy.
- **Toolbar**: Copy / Export / Save / Duplicate / Print, always visible on desktop.
- **AssumptionList / OpenQuestions / NextActions**: labelled, separated from facts.

## Icons
Lucide only, 1.5px stroke, 20–24px, used sparingly and meaningfully. No robot/brain/sparkle.

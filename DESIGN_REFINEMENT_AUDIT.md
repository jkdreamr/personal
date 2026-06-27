# Harbor — Design Refinement Audit

A refinement pass, not a rebuild. All routes, service logic, storage, exports, evidence handling,
and privacy safeguards are preserved. The goal is to make Harbor feel quieter, more mature, and
obviously useful in five seconds — less like an AI dashboard, more like a private executive tool.

## What currently feels "AI-generated"
- **Two characterful fonts** (Newsreader editorial serif + Hanken Grotesk) with a large serif hero.
  The serif display reads as "designed AI product," not a sober work tool.
- **Oversized hero text** (`text-4xl`/`text-5xl`) used for drama on Home and service first-screens.
- **All-caps eyebrow labels everywhere** (`CREATE`, `INTELLIGENCE`, `MOST-USED SERVICES`, `WHAT YOU
  ASKED FOR`, `CLAIM CHECKS`, `OPEN QUESTIONS`…). All-caps micro-labels are a telltale AI-dashboard tic.
- **Twelve large service cards** competing above the fold on Home.
- **Three side-rail groups with an icon per item** — reads like a "command center."
- **Everything visible at once in the workspace**: full 5-step stage rail, full source list, full claim
  classifications, assumptions, open questions, next steps, refine chips, plus a demo banner.

## What creates cognitive overload
- Home asks the user to read a hero, an intake card, a 12-card directory, and a privacy note before doing anything.
- The workspace right panel shows claim checks + open questions + next steps + sources simultaneously,
  competing with the result itself.
- The toolbar shows Copy, Export, Print, Duplicate, New, and Privacy all at once.
- Repeated helper copy: per-service `helper` lines, `coverageNote`, demo banner, panel sub-labels.
- The processing view enumerates five internal stages — machinery the user doesn't need to watch.

## What can be removed, collapsed, or delayed
- Collapse the right panel to a **one-line evidence summary** ("Based on 6 sources · 2 to confirm") that
  expands on click. Hide claim classifications unless the task is research-heavy or the user opens them.
- Make the left context panel **compact and collapsible**; the result should dominate.
- Move Print / Duplicate / New into a **single overflow**; keep Copy + Export visible.
- Replace the 5-step stage rail with **one calm status line** (still driven by real execution).
- Home: drop the 12-card grid above the fold; show intake + 3–5 recent items, with a quiet **Browse tools**.
- Sidebar: **Home · Library** up top, a quieter expandable **Tools** list (no icons, no group headers),
  Settings/Voice subdued.
- Remove per-service helper lines from busy screens; keep one calm sentence.

## Screens needing the largest changes
1. **Typography (global)** — biggest single lever.
2. **Home** — from showcase to a single obvious action.
3. **Workspace** — result-first; evidence and context collapsed by default.
4. **Sidebar** — from command center to a calm rail.

## Font decision
Switch to a **single neutral system stack**: `"Helvetica Neue", Helvetica, Arial, sans-serif`.
No Google fonts, no display serif, no trendy startup font. Reasoning: it is familiar, highly legible
for older readers, renders instantly (no font fetch / layout shift), and signals "serious private tool"
rather than "AI product." Hierarchy comes from **size, weight, spacing, and layout** — not from the
typeface. Headings use sentence case and restrained sizes (hero ≤ `text-3xl`); micro-labels lose all-caps.

## Model-routing changes
- **Owl Alpha (`openrouter/owl-alpha`) is the default** for every meaningful task (write, research,
  notes, present, proposal, brief, meeting, decide, **challenge**, explain, verify, compare).
- **GPT-OSS** only for trivial work: short rewrite, title, formatting cleanup, simple classification.
- **Nemotron** only for an **explicit** "second opinion" the user requests — never auto-invoked after Owl.
- Add `restricted: "poolside/laguna-m.1:free"` to the model map, **disabled by default** (never used for
  user content).
- One Owl call per task by default; fallback chain limited to Owl → GPT-OSS (no auto-Nemotron, no Laguna).
- No background calls; no type-ahead autocomplete calls; at most one repair retry.
- Add **owner-only** model-call instrumentation (task type, model, #calls, success/failure, rate-limit,
  approx tokens) behind a token-gated `/diagnostics` page — never shown to normal users.

## Implementation plan
1. Typography: system stack in CSS + Tailwind; drop `next/font`; remove serif/display; reduce hero sizes;
   convert `Eyebrow` to sentence-case; replace `font-display` usages.
2. Home: intake-first; 3–5 recent; secondary "Browse tools"; remove the big directory above the fold.
3. Sidebar: Home · Library; expandable quiet Tools; subdued Settings/Voice; remove per-item icons + group caps.
4. Workspace: result-first grid; collapsible compact context; collapsed evidence drawer with summary;
   claim classifications behind the drawer; toolbar overflow; single-line status (no step rail).
5. Model routing: Owl default everywhere; Challenge→Owl; explicit "Second opinion"→Nemotron; add Laguna
   (disabled); trim fallback; add instrumentation + `/diagnostics`.
6. Verify: typecheck, lint, unit, E2E + axe, production build, and before/after screenshots.

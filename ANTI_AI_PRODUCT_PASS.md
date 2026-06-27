# Harbor — Anti-Generic-Design Pass

A review of every major route to remove generic-AI product language and visuals. Verified via
screenshots at desktop (1280/1440) and mobile (375/390) during the build.

## Removed / never present

| Anti-pattern | Status |
|---|---|
| Purple gradients, neon, glassmorphism, gradient text, glowing cards | Not used. Flat, fixed neutral palette only. |
| Sparkles / robot / brain / blob iconography | Not used. Lucide line icons, used sparingly. |
| Giant chat box / chatbot-style long outputs | Replaced by a labelled one-sentence intake + structured artifacts. |
| Pill soup, bento overload, excessive shadows | Restrained: 6–10px radii, hairline borders, shadows only on overlays. |
| Generic SaaS dashboard chrome | Editorial workbench: left rail + three-panel workspace. |
| Fake metrics / activity / avatars | None. "Recent work" shows only real local artifacts; empty state is honest. |
| Citation theater | Sources are real, typed, trust-tiered, with exact excerpts; demo never fabricates. |
| "AI-powered / supercharge / unlock / seamless / magic / copilot" etc. | Banned in copy; not present. |
| Tiny or low-contrast text | Muted *text* tuned to ≈5.5:1 on canvas (axe-verified); base body 16px. |
| Decorative-only animation | Motion limited to 120–240ms fades; respects `prefers-reduced-motion`. |

## Typography & hierarchy
Editorial serif (Newsreader) only for large display statements (home hero, slide titles); warm
humanist sans (Hanken Grotesk) for everything else — deliberately not Inter/Roboto/Arial. Clear
scale; weights carry hierarchy; tabular figures for metadata.

## Per-route checks
- **Home** — calm hero, single intake card, quiet inferred-intent line (not a form), restrained
  service grid, honest recent-work + privacy reminder.
- **Workspace** — three panels (Context/Work/Sources); always-visible Copy/Export; real stage rail
  (no fake "thinking"); demo banner labelled; editable artifact.
- **Library / Voice / Settings** — list-first, no charts/fake stats; clear empty states; destructive
  actions separated + confirmed; voice profiles strictly opt-in.
- **Access / Privacy** — quiet, trustworthy; exact beta warning; no marketing.

## Accessibility (built for a focused 60-year-old)
WCAG AA contrast (axe: 0 serious/critical on access, home, workspace); visible focus rings never
removed; semantic headings; labelled inputs; icon-only buttons have `aria-label`; classification and
status never rely on color alone (always a text label); `aria-live` for stages and toasts; skip link;
44px touch targets; no mobile horizontal overflow; responsive comparison cards.

## Empty / error / recovery states
Every service has an empty first screen, loading skeletons + real stages, plain-language errors with
Retry that preserve work, and provider-outage messaging ("…the free research model is temporarily
unavailable. Your work is still saved here.").

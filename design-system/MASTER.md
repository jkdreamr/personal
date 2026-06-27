# Harbor — Design System (MASTER)

The global source of truth. Page files in `design-system/pages/` override only where noted.

## Voice & tone

Calm, mature, direct, capable, specific, reassuring, understated, professional. Never cheerful,
robotic, patronizing, or hype-driven. Harbor is a capable colleague handing back clear work — not
a product shouting about AI.

Banned in UI copy: AI-powered, AI assistant, Supercharge, Unlock, Seamlessly, Revolutionize,
Leverage, Game-changing, Next-level, Your second brain, Chat with your documents, Productivity at
the speed of thought, Transform your workflow, Magic, Copilot.

## Palette (fixed — never overridden)

| Token | Hex | Use |
|-------|-----|-----|
| `--harbor-canvas` | `#F7F7F7` | Page background |
| `--harbor-surface` | `#EEEEEE` | Cards, input fills, panels, hover, dividers |
| `--harbor-ink` | `#393E46` | Primary text, icons, borders, buttons, emphasis |
| `--harbor-muted` | `#929AAB` | Secondary text, muted labels, inactive, metadata |

Semantic colors (used sparingly, never color-alone — always paired with a label or icon):
- success `#2F6F57`, warning `#9A6B2E`, danger `#9A3B36`. All meet ≥4.5:1 on canvas/surface.

Contrast notes: `--harbor-ink` on `--harbor-canvas` ≈ 9.3:1 (AAA). The brand swatch `#929AAB`
reaches only ≈2.6:1 on the canvas (below WCAG AA), so it is kept as `--harbor-muted-soft` for
purely decorative/inactive tints, and the `--harbor-muted` *text* token is tuned to `#5C6573`
(≈5.5:1 on canvas, ≈5.1:1 on surface) so all secondary text is legible. This is verified by axe in
the test suite (0 serious/critical violations). Never use `muted-soft` for text.

## Typography

- **One neutral system stack** for everything: `"Helvetica Neue", Helvetica, Arial, sans-serif`.
  No Google fonts, no editorial serif, no trendy startup face. Reasoning: familiar, highly legible
  for older readers, renders instantly (no font fetch / layout shift), and reads as a serious private
  tool rather than an "AI product". Hierarchy comes from size, weight, spacing, and layout — not the
  typeface. (`font-display` is aliased to the same stack, so it is never a real display font.)
- Sentence case everywhere — navigation, buttons, labels, section headings. No all-caps eyebrows.
- Base body 16px (mobile too), line-height 1.5–1.65, measure 60–75ch for long text.
- Restrained sizes: page/hero headings ≤ ~28px (`text-2xl`/`1.75rem`); no oversized hero text for drama.
- Weights: 400 body, 500 labels/nav, 600 headings. Tabular figures for any numeric/budget/date column.

## Spacing & layout

- 4/8px rhythm. Section spacing tiers 16 / 24 / 32 / 48 / 64.
- Thin 1px borders in `--harbor-ink` at 10–14% opacity (`color-mix`) for structure; full ink only
  for strong emphasis/buttons. Restrained shadows only for overlays (dialogs, popovers, toasts).
- Desktop: persistent 248px left rail + three-panel workspace. Comfortable reading width in the
  center panel (max ~720px for prose).
- Radius: 10px cards/inputs, 8px buttons, 6px chips. No pill-everything.

## Interaction & motion

- Visible focus ring (2px ink, 2px offset) on every interactive element. Never remove it.
- Hover: surface fill or subtle border darkening, 120–180ms ease. Press: 0.99 scale on buttons.
- Motion 120–240ms, transform/opacity only, respects `prefers-reduced-motion`.
- Touch targets ≥44px. Cursor pointer on clickables.

## Accessibility (WCAG AA, built for a focused 60-year-old)

- Semantic headings h1→h… no skips. Labels tied to inputs. Icon-only buttons get `aria-label`.
- Status/stage updates via `aria-live="polite"`. Errors via `role="alert"`, with cause + fix.
- Color never the sole signal (claim classifications, success/warning/danger all carry a label).
- Comfortable text sizes; nothing critical in muted gray; supports browser zoom.

## Anti-generic-AI rules (hard no)

No purple gradients, neon, glassmorphism, gradient text, glowing cards, sparkles, robot/brain
icons, floating blobs, giant chat boxes, pill soup, bento overload, excessive shadows, generic
SaaS dashboard chrome, fake metrics/activity/avatars, default component-library look, citation
theater, tiny/low-contrast text. Icons: Lucide, single stroke language, used sparingly.

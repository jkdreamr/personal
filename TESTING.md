# Harbor — Testing

All automated tests run against **demo mode** with **fixtures and mocks** — no live external sites
and no real model calls. Determinism is guaranteed by the local demo engine.

## Run

```bash
npm run typecheck          # tsc --noEmit
npm run lint               # eslint
npm run test               # vitest unit tests
npm run test:e2e:install   # once: fetch Chromium
npm run test:e2e           # playwright (auto-builds + serves in demo mode, gate off)
npm run build              # production build
```

## Unit tests (Vitest) — 63 tests, 9 files

- `url-safety` — SSRF: private/loopback/link-local/metadata IPv4+IPv6 blocking; protocol/host checks.
- `research` — robots.txt parse + longest-match allow/disallow; trust-tier classification; discovery
  ranking + crawl cap + cross-origin exclusion.
- `evidence` — verified-fact citation requirement (downgrade when unsupported); `normalizeArtifact`;
  claim-classification schema.
- `model-routing` — fast vs synthesis vs reviewer routing; no paid models / no `auto`; fallback chain;
  capability handling (safe default, no network without a key).
- `intent` — task classification across all services + confidence/auto-proceed.
- `editorial` — playbook warnings (clichés, exclamation); editorial pass; **voice-profile opt-in**
  requires both `enabled` and per-task confirmation.
- `export` — markdown/text/CSV/TSV/evidence-package formatting; clean filenames; no internal data;
  edited-body preservation.
- `session` — beta cookie sign/verify, tamper rejection, edge↔node byte-compatibility; timing-safe
  compare.
- `parsing` — model JSON extraction (fences, trailing commas, braces-in-strings); readable-content
  extraction (sanitized text, same-origin links, noindex).

## End-to-end tests (Playwright) — 17 tests, 7 files

- `access` — access page renders and the form submits into the app.
- `write` — produces a draft, copies clean text to the clipboard, exports a real `.md` download;
  refinement chips re-run without losing the workspace.
- `services` — Present (slide deck + Present button), Compare (table + criteria prompt), Challenge
  (every point carries a classification label), Research (user-provided source shown), Explain
  (non-advice disclaimer).
- `notes-ocr` — uploads a fixture image, shows the image preview + manual-correction editor, and the
  corrected text drives the result (real OCR-failure → correction path; demo skips the engine).
- `library` — saved work appears in the Library and survives a workspace refresh (IndexedDB restore);
  delete offers Undo.
- `resilience` — an intercepted provider failure shows a plain-language error + Retry and preserves
  work, then Retry succeeds; mobile bottom navigation works; empty input can't start a task.
- `a11y` — axe (WCAG 2 A/AA) on the access page, home, and a workspace with a result: **zero
  serious/critical violations**.

## Current results

```
Typecheck   ✓
Lint        ✓ (no warnings or errors)
Unit        ✓ 63 passed
E2E + axe   ✓ 17 passed
Build       ✓ (21 routes, edge middleware)
```

## Notes
- The E2E web server runs `npm run build && npm run start` with `NEXT_PUBLIC_DEMO_MODE=true` and
  `BETA_GATE_ENABLED=false`, so tests never need a key or a session cookie.
- OCR accuracy is not asserted (it depends on the browser/CDN); the test exercises the
  upload → review → correct → use flow, which is the part Harbor controls.

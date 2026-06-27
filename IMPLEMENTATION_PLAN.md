# Harbor — Implementation Plan

> Make sense of the work in front of you.

Harbor is a calm, tab-based workbench that turns material someone already has — an email,
a photo, a document, a rough note, a company link — into clear work they can use. This plan
is the contract the implementation follows.

## 0. Operating assumptions (documented, not asked)

These are decisions made by inspecting the repo and the brief. They are deliberate.

1. **Stack**: Next.js 15 (App Router) + React 19 + TypeScript + Tailwind v3.4. Hand-written
   accessible primitives built on a small set of Radix packages (dialog, popover, tooltip,
   tabs, toast, label, slot). No component-library "default look".
2. **No accounts, no server database.** All user work lives in the browser (IndexedDB via
   Dexie). The server is stateless: it only proxies model calls and fetches public URLs.
3. **Files are parsed in the browser** (pdfjs-dist, mammoth, tesseract.js, a local EML
   parser). Only extracted *text* is ever sent to a model. This keeps documents on-device,
   which is the privacy promise. (Deviation from the brief's `mailparser` suggestion: that
   library is Node-only and would force email uploads to the server; a compact local MIME
   parser keeps email content on the device instead. Documented in ARCHITECTURE.md.)
4. **Web retrieval is server-side** (`/api/research`) with strict SSRF protection, robots
   respect, crawl/concurrency/size limits. The model never "browses" — it only sees text
   Harbor fetched and sanitized.
5. **Model calls are server-side only** (`/api/task`). The OpenRouter key never reaches the
   browser. Models: `openrouter/owl-alpha` (primary), `nvidia/nemotron-3-ultra-550b-a55b:free`
   (reviewer/challenge), `openai/gpt-oss-120b:free` (fast). Output is requested as JSON,
   extracted robustly, and validated with Zod; one repair retry on schema failure.
6. **Demo mode** (`NEXT_PUBLIC_DEMO_MODE=true`, or automatically when no `OPENROUTER_API_KEY`
   is configured): the task engine produces deterministic artifacts built *from the user's
   own input and attached text* — clearly labelled "Demo example (offline sample)". Demo
   outputs never invent external facts, citations, or URLs. This makes the entire product
   usable and end-to-end testable with no key, and is what the automated tests run against.

## 1. Shared engine (build once, reuse everywhere)

Every service is a thin configuration over shared infrastructure:

- **Service registry** (`lib/services.ts`): id, group, label, route, hero copy, primary verb,
  prompt id, output schema id, accepted refinement actions.
- **Common Artifact shape** (`lib/types.ts`): `title`, `summary`, `sections[]`, `claims[]`,
  `sources[]`, `assumptions[]`, `openQuestions[]`, `nextActions[]`, `disclaimer`, plus optional
  `email`, `slides[]`, `comparison`. One generic `ArtifactView` renders all of it; Present,
  Compare, Verify/Challenge add specialized views.
- **Evidence system** (`Source`, `Claim`): typed, with trust tiers and required excerpts for
  any `verified_fact`.
- **Task runner** (`lib/ai/task-runner.ts`): prompt + context → model (or demo) → JSON →
  Zod → Artifact. Streams real stages over the response.
- **Local store** (Dexie): Workspace, Task, Artifact, Attachment, Source, Claim, VoiceProfile,
  Preference, JobStatus, UsageBudget. Autosave, restore, duplicate, delete, export/import JSON.
- **Intent inference** (`lib/intent.ts`): first sentence + attachments → likely service, with a
  confidence score that drives "proceed automatically" vs "one light confirmation".

## 2. Services (all real, none "coming soon")

Write, Notes, Present, Proposal, Research, Challenge, Verify, Compare, Brief, Meeting, Decide,
Explain. Each: minimal first screen (one sentence + optional context + one button), inferred
defaults, ≤3 refinement actions, a collapsed "Adjust this" section. Specialized output:
Present → in-browser slide deck + presentation mode + print; Compare → comparison table +
CSV/TSV; Verify/Challenge → claim-by-claim cards with classification labels; Research/Brief →
sources & limitations.

## 3. Cross-cutting

- **Workspace**: three panels (Context / Work / Sources) on desktop; segmented Context|Work|Sources
  on mobile. Always-visible Copy, Export, Save, Duplicate, Print. Real stage rail, Cancel, Retry,
  autosave, recover-after-error.
- **Editorial**: writing playbook, style-lint (cliché warnings as suggestions, never auto-rewrite),
  opt-in local Voice Profiles, Editorial Pass action on writing services.
- **Export**: Markdown, TXT, print-to-PDF (clean print stylesheet), JSON evidence package,
  CSV/TSV for tables, full Harbor JSON backup. Never show export success unless a file was made.
- **Access gate**: `/access`, signed cookie, timing-safe code compare, middleware over app routes.
- **Privacy**: `/privacy` + workspace privacy panel, exact warning copy, `Cache-Control: no-store`
  on processing routes, prompt-injection defense (retrieved/uploaded text is data, never instructions).

## 4. Quality gates

Typecheck, lint, Vitest unit tests (url safety/SSRF, robots, trust tier, claim/citation rules,
model routing, capability handling, intent classification, playbook warnings, voice opt-in,
export formatting, beta cookie), Playwright E2E in demo mode (access gate, write, notes OCR with
a fixture image, research with a local fixture, challenge labels, present preview, compare,
library save/restore, copy, export markdown, print layout, mobile nav, retry after failure,
refresh during a saved task), axe accessibility checks, production build. Fix meaningful issues.

## 5. Build order

1. Project config + design tokens + fonts.            ← foundation
2. Types, services registry, intent, Dexie store.
3. AI layer (client, router, capabilities, runner, prompts, schemas, demo, fallback).
4. Research layer (validate/robots/fetch/extract/crawl/discovery/normalize/trust/citation).
5. File parsing (pdf/docx/eml/ocr).
6. Editorial (playbook/voice/lint/pass). Export (md/txt/json/csv/print/filename).
7. API routes + middleware + env validation + session.
8. UI primitives → app shell (sidebar + mobile nav) → home → shared workspace → service pages.
9. Library / Voice / Settings / Privacy / Access pages.
10. Tests (unit + E2E + axe). Docs. Anti-AI pass. Reliability checklist. Build.

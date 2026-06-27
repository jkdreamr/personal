# Harbor

> Make sense of the work in front of you.

Harbor is a calm, tab-based workbench that turns the material already on someone's desk — an
email, a photo, a document, a rough note, a company link — into clear work they can understand,
edit, send, present, or act on. It is built for experienced professionals, investors, founders,
consultants, and capable older users who don't want to write prompts or configure models.

The promise: **Add what you have. Say what you need in one sentence. Harbor handles the rest.**

This is a private-beta, local-first web app. There are no accounts and no server database — your
work lives in your browser. Files are read on your device; only extracted text is ever sent to a
model. Web pages are fetched server-side with strict SSRF protection.

---

## What's inside

Twelve real services over one shared engine:

- **Create** — Write · Notes · Present · Proposal
- **Intelligence** — Research · Challenge · Verify · Compare · Brief
- **Action** — Meeting · Decide · Explain
- **Personal** — Library · Voice · Settings

Plus a typed evidence system (sources + classified claims), local-first storage (IndexedDB/Dexie),
copy/export/print, a private-beta access gate, and a **demo mode** that produces real results with
no API key (used for offline use and the test suite).

See [`IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md), [`ARCHITECTURE.md`](ARCHITECTURE.md),
[`PRIVACY_NOTES.md`](PRIVACY_NOTES.md), and [`TESTING.md`](TESTING.md).

---

## Requirements

- Node.js 20+ (developed on 22.11)
- npm

## Local setup

```bash
npm install --legacy-peer-deps
cp .env.example .env.local        # then edit values (see below)
npm run dev                       # http://localhost:3000
```

With no `OPENROUTER_API_KEY` set (or `NEXT_PUBLIC_DEMO_MODE=true`), Harbor runs in **demo mode**:
every service works and builds results locally from your input, clearly labelled "Demo example".
Add a key to enable full drafting, research, and web retrieval.

## Environment variables

| Variable | Required | Notes |
|----------|----------|-------|
| `OPENROUTER_API_KEY` | for live mode | Server-side only. Empty → demo mode. |
| `BETA_ACCESS_CODE` | when gate on | The private-beta code users enter at `/access`. |
| `BETA_SESSION_SECRET` | when gate on | ≥32 chars in production. Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `BETA_GATE_ENABLED` | no (default `true`) | Set `false` to disable the access gate. |
| `FREE_DAILY_TASK_BUDGET` | no (default `15`) | Soft per-browser daily task budget. |
| `NEXT_PUBLIC_APP_NAME` | no | Default `Harbor`. |
| `NEXT_PUBLIC_DEMO_MODE` | no | `true` forces demo mode (also used by tests). |
| `MAX_FILE_SIZE_MB` | no (default `10`) | |
| `MAX_ATTACHMENTS_PER_TASK` | no (default `6`) | |
| `MAX_URL_PAGES` | no (default `12`) | Max pages crawled per company site. |
| `SEARCH_PROVIDER` | no (default `none`) | Broad web search is off by default (no paid provider). |

Only `NEXT_PUBLIC_*` values reach the browser. `OPENROUTER_API_KEY` never does.

## Commands

```bash
npm run dev          # dev server
npm run build        # production build
npm run start        # serve the production build
npm run typecheck    # tsc --noEmit
npm run lint         # eslint (next lint)
npm run test         # vitest unit tests
npm run test:e2e     # playwright (builds + serves in demo mode automatically)
```

First-time E2E: `npm run test:e2e:install` to fetch the Chromium browser.

## Models

Live mode uses OpenRouter (server-side) with exactly these IDs — no paid models, no `openrouter/auto`:

```
primary:  openrouter/owl-alpha                       # synthesis, research, long writing
reviewer: nvidia/nemotron-3-ultra-550b-a55b:free     # Challenge / adversarial review
fast:     openai/gpt-oss-120b:free                    # rewrites, classification, titles
```

Output is requested as JSON, extracted robustly, validated with Zod, and repaired once on failure.
Capabilities (e.g. JSON mode) are queried from OpenRouter and cached; when unknown, Harbor assumes
the safe minimum and relies on prompt-based JSON + validation.

## Deployment (Vercel)

No database or paid infrastructure is required.

```bash
# 1) Push to a Git repo and "Import Project" in Vercel, or use the CLI:
npm i -g vercel
vercel link
# 2) Set environment variables (Production):
vercel env add OPENROUTER_API_KEY production
vercel env add BETA_ACCESS_CODE production
vercel env add BETA_SESSION_SECRET production      # use a strong 32+ char secret
vercel env add BETA_GATE_ENABLED production         # "true"
# 3) Deploy:
vercel --prod
```

After deploying, verify: the app loads, `/access` gates the app (a wrong code is rejected, the
correct code lets you in), and at least one non-demo route returns a real, source-backed result.

---

## Honest limitations

- **Demo vs live**: without a key, results are built locally and labelled "Demo example"; they never
  invent outside facts, citations, or URLs, and demo mode does not fetch the web.
- **Free models** vary in availability and speed; Harbor falls back through approved free models once
  and never promises fixed timing or unlimited use.
- **OCR** uses `tesseract.js`, which downloads its engine/language data from a CDN on first use; in
  demo/offline mode OCR is skipped and routes you to manual text correction.
- **PPTX export is intentionally not shipped** (it isn't verified end-to-end). Presentations support
  an in-browser present mode, print-to-PDF, and outline/notes copy instead.

## Write studio (live writing)

`/write` is a cursor-style writing surface: type freely with **ghost-text autocomplete** (Tab to
accept, Esc to dismiss), **live editorial hints** (local, instant), and streaming **Auto-write /
Continue / Improve selection** actions. Generation **streams** token-by-token (`/api/compose`,
SSE from OpenRouter) so the draft appears as it's written rather than after a long wait — the
biggest perceived-speed win. In demo mode the studio streams a locally-built draft and a light
heuristic ghost suggestion, so the whole experience is testable without a key.

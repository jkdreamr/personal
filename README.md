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
| `SEARCH_PROVIDER` | no (default `auto`) | `auto` tries SearXNG → Brave → Wikipedia. Also `none`, `wikipedia`, `brave`, `searxng`. |
| `SEARXNG_URL` | no | A SearXNG instance you control → **unlimited, $0, full-web search** (see below). |
| `BRAVE_SEARCH_API_KEY` | no | Free Brave key → full web, but the free tier is capped (~2k/month). |

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

Live mode runs entirely on **free** models — no paid models, no `openrouter/auto`. OpenRouter alone
is enough; adding any of the optional providers (each a free tier with its own rate-limit pool) makes
Harbor faster and more resilient. Base OpenRouter IDs:

```
primary:  openrouter/owl-alpha                       # synthesis, research, long writing
reviewer: nvidia/nemotron-3-ultra-550b-a55b:free     # Challenge / adversarial review
fast:     openai/gpt-oss-120b:free                    # rewrites, classification, titles
```

Optional extra free providers (tagged `provider::model`, used only when their key is set):

```
groq::llama-3.3-70b-versatile  groq::llama-3.1-8b-instant   # Groq — extremely fast (autocomplete, rewrites)
cerebras::llama-3.3-70b        cerebras::llama3.1-8b        # Cerebras — fastest inference
google::gemini-2.5-flash                                    # Gemini — strong + 1M-token context (long docs)
mistral-small-latest                                        # Mistral — cross-provider last resort
```

**Task-aware routing** (`lib/ai/model-router.ts`, `chainFor(kind)`): each kind of work has an ordered
chain of best-fit models, filtered to whichever providers you've configured, tried in order until one
succeeds. Each model is matched to its strength:

- **Latency-sensitive** work (autocomplete, titles, classification) leads with Cerebras/Groq (fastest
  inference). These stay lean — a missed suggestion is silent, never an error.
- **Quick rewrites** (Continue / Improve) lead with a fast 70B, then Gemini.
- **Full synthesis** leads with the *service's declared strength* (`services.ts` `model`): most
  services → **Owl** (best generalist), with Gemini's 1M context as the first fallback for long,
  source-heavy work; **Challenge** → **Nemotron** (reasoning/adversarial); **Notes** → a fast 70B.
- **Explicit second opinion** leads with a strong, *different* reviewer (Nemotron).

**Always a fallback (no errors).** Quality tasks (synthesis, rewrite, second opinion) append an
*exhaustive safety net* — every other configured model, best→smallest — so as long as one provider is
reachable, a real result comes back. A failure on any one model (including an auth error from a single
bad provider key) just advances to the next model on a different provider; only user cancellation
stops the chain. Provider routing lives in `lib/ai/providers.ts`; the chains in `lib/ai/model-router.ts`.

Output is requested as JSON, extracted robustly, validated with Zod, and repaired once on failure.
Capabilities (e.g. JSON mode) are queried from OpenRouter and cached; when unknown, Harbor assumes
the safe minimum and relies on prompt-based JSON + validation (works across every provider).

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

## Live editing on every tool

`/write` is a cursor-style writing surface, and the same editor (`components/editor/Composer.tsx`)
powers the **Edit** mode of every other tool. Anywhere you have a result you can: type freely with
**ghost-text autocomplete** that appears as you write — a short pause surfaces one immediately and a
~10s heartbeat keeps offering fresh continuations during a long burst (Tab accept, Esc dismiss),
see **live editorial hints** (local, instant),
**Continue** from the end, **Improve selection**, and **Regenerate** the whole thing or refine it.
Generation **streams** token-by-token (`/api/compose`, SSE) so text appears as it's written. In demo
mode the editor streams a locally-built draft + heuristic ghost, so it's fully testable without a key.

## Cost — everything is free

Harbor must never incur per-token cost. Every model it can call is zero-priced — OpenRouter free
models (`owl-alpha` is a free stealth model; the rest are `:free` variants), plus the free tiers of
Groq, Cerebras, Google AI Studio (Gemini), and Mistral. A hard guard (`assertFreeModel`, backed by a
`FREE_ALLOWLIST`) refuses to call anything else. No paid APIs, databases, search, or analytics anywhere.

**The real-world guarantee:** none of these providers can bill you unless you explicitly add a payment
method and opt into a paid tier. With no card on file, the worst case is a rate-limit error, never a
charge. So: keep OpenRouter on free credits (the models above are $0 regardless), and don't enable
billing on Groq / Cerebras / Google AI Studio / Mistral. Verified $0 as of 2026-06: OpenRouter prompt/
completion = 0 (live catalog); Groq & Cerebras free tiers (no card, rate-limited); Google AI Studio
free tier (Flash models only — Pro is paid; we use `gemini-2.5-flash`); Mistral free "Experiment" tier.

**Resilient, task-aware, cross-provider fallback.** Every generation degrades through free models so a
single flaky one never errors. The chain is chosen per task (`chainFor(kind)`) and filtered to the
providers you've configured — e.g. synthesis is **Owl → Gemini → fast 70B → GPT-OSS → Nemotron →
Mistral**, autocomplete is **Cerebras → Groq → GPT-OSS**. Each extra provider has its own rate-limit
pool, so configuring more means more headroom and speed. With only `OPENROUTER_API_KEY` set, Harbor
still works (it just uses the OpenRouter models). This applies to result generation (`/api/task`), the
writing editor (`/api/compose`), and inline autocomplete (`/api/autocomplete`).

## Unlimited, $0 web search (SearXNG)

There is no key-less, *unlimited*, full-web search API that works from a server (Google/Bing/DuckDuckGo
block datacenter IPs; Brave/Tavily/Serper cap their free tiers). The one solution that is genuinely
**free and uncapped** is **SearXNG** — open-source metasearch you run yourself. Harbor integrates with
it directly:

1. Run SearXNG (free, ~1 command), enabling the JSON format:
   ```bash
   docker run -d --name searxng -p 8080:8080 \
     -e "SEARXNG_SETTINGS__SEARCH__FORMATS=[html,json]" searxng/searxng
   ```
   Host it anywhere always-on and free (a free VPS, Fly.io, Render, an Oracle Cloud free VM, etc.).
2. Set `SEARXNG_URL` to its public URL in Vercel and redeploy.

Now Research / Verify / Challenge / Brief / Meeting get **unlimited full-web results at $0**, with no
per-query cost and no monthly cap. Without it, Harbor falls back to key-less **Wikipedia** (works out
of the box, but encyclopedic only) or **Brave**'s free tier if `BRAVE_SEARCH_API_KEY` is set. The
search layer is an ordered composite (`SearXNG → Brave → Wikipedia`) so it always returns something.

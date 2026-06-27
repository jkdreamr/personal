# Harbor — Architecture

## Shape

- **Next.js 15 (App Router) + React 19 + TypeScript + Tailwind v3.** Hand-built primitives on a
  small set of Radix packages (dialog, popover, tooltip, tabs, toast, label, slot) — no default
  component-library look.
- **No accounts, no server database.** The server is stateless: it proxies model calls and fetches
  public URLs. All user work lives in the browser (IndexedDB via Dexie).
- **One shared task engine.** Every service is a declarative configuration over the same engine,
  evidence system, storage, workspace UI, and export system.

```
Browser (local-first)                         Server (stateless)
┌────────────────────────────┐                ┌─────────────────────────────┐
│ Home intake → intent infer │                │ /api/task   (NDJSON stream) │
│ Service pages → Workspace  │  fetch (text)  │  ├─ retrieveSources (live)  │
│ File parsing (pdf/docx/    │ ─────────────► │  └─ runTask → model | demo  │
│   eml/ocr) — on device     │                │ /api/research (SSRF-safe)   │
│ Dexie store (tasks, voice, │ ◄───────────── │ /api/autocomplete           │
│   prefs, budget)           │  artifact JSON │ /api/access (signed cookie) │
│ Export / Copy / Print      │                │ middleware (beta gate, edge)│
└────────────────────────────┘                └─────────────────────────────┘
```

## Key modules

### Service registry — `lib/services.ts`
Declarative config per service: group, label, icon, hero copy, default model tier, refinement
actions, and capability flags (`usesResearch`, `producesEmail`, `producesSlides`,
`producesComparison`, `producesClaims`, `sensitive`, `editorial`). The UI, prompts, and routing all
read from here, so adding/altering a service is a config change, not new plumbing.

### Common artifact — `lib/types.ts`
Every service returns one `Artifact`: `title`, `summary`, `sections[]`, `assumptions[]`, `claims[]`,
`sources[]`, `openQuestions[]`, `nextActions[]`, `disclaimer`, `coverageNote`, plus optional `email`,
`slides[]`, `comparison`. A generic renderer handles the common fields; Present, Compare, and
Verify/Challenge add specialized views.

### AI layer — `lib/ai/`
- `openrouter-client.ts` — server-side chat completions; AbortController, timeout, retryable errors.
- `model-router.ts` — the three allowed model IDs + routing (lightweight → fast, synthesis → service
  preference, Challenge → reviewer) and a free-only fallback chain.
- `provider-capabilities.ts` — queries/caches OpenRouter `/models`; assumes the safe minimum when
  unknown (no blind assumption of JSON mode / image input / tools / streaming).
- `prompts.ts` — system prompt with the prompt-injection defense + JSON contract; per-service guidance.
- `task-runner.ts` — demo vs live; JSON extraction → Zod validation → one repair retry → fallback
  model; `normalizeArtifact` enforces that a `verified_fact` cites a real source (else downgrades).
- `demo.ts` — deterministic, input-derived artifacts for offline/no-key use; never invents facts.

### Retrieval — `lib/research/`
- `url-shape.ts` (isomorphic) + `validate-url.ts` (adds DNS) — SSRF protection: blocks non-http,
  localhost, private/reserved/link-local/metadata ranges, and public hostnames that resolve to
  private IPs.
- `fetch-url.ts` — timeouts, size cap, content-type checks, manual redirect re-validation.
- `robots.ts`, `crawl-domain.ts`, `source-discovery.ts` — robots respect, ≤`MAX_URL_PAGES` same-domain
  crawl, priority for About/Product/Pricing/Team/Press/etc., dedup, retrieval timestamps.
- `extract-readable-content.ts` (cheerio) — strips boilerplate; returns sanitized text only (scraped
  HTML is never rendered). `trust-tier.ts`, `source-normalizer.ts`, `citation-builder.ts`,
  `search-adapter.ts` (broad search disabled by default — pluggable, no paid provider).

### Files — `lib/files/` (client only)
`pdf.ts` (pdfjs-dist), `docx.ts` (mammoth), `eml.ts` (compact local MIME parser — see note),
`ocr.ts` (tesseract.js), `extract.ts` (dispatcher with size/type checks, image preview, and a
manual-correction path for images/low-confidence OCR/scanned PDFs).

> **EML note:** the brief suggested `mailparser`, which is Node-only and would require uploading the
> email to the server. To keep email content on-device (the privacy promise), Harbor parses EML in
> the browser with a small MIME/quoted-printable/base64 parser.

### Editorial — `lib/editorial/`
`writing-playbook.ts` (rules + flagged clichés), `style-lint.ts` (non-destructive warnings),
`voice-profile.ts` (strict opt-in; never auto-applied), `editorial-pass.ts` (editable suggestions).

### Storage & export
`lib/db/` (Dexie: tasks embed attachments + artifact, voice profiles, prefs, daily budget;
export/import full JSON backup). `lib/export/` (markdown, text, CSV/TSV, JSON evidence package,
clean filenames) + `lib/client/download.ts`. Print uses a dedicated stylesheet; a print-only
appendix re-includes side-panel evidence so the PDF is self-contained.

### Access gate
`middleware.ts` (Edge) verifies a signed cookie with Web Crypto, byte-compatible with the Node
signer in `lib/auth/session.ts` (HMAC-SHA256). Access-code compare is timing-safe.

## Request flow (a task)
1. UI collects a one-sentence goal + optional attachments (files parsed locally to text; links kept
   as URLs). Intent is inferred on the home page.
2. `POST /api/task` streams NDJSON stage events. Live mode retrieves sources for link-bearing
   research services, then calls the routed model; demo mode builds locally and stays offline.
3. Model JSON → Zod → `normalizeArtifact` (citation rules, source ordering) → streamed `result`.
4. The client autosaves to IndexedDB throughout; the URL is synced to the task id so a refresh
   restores the exact task.

## Security posture
Server-only model key; SSRF-guarded retrieval; sanitized extracted text; prompt-injection defense
(retrieved/uploaded content is data, never instructions); `Cache-Control: no-store` on processing
routes; defense-in-depth headers; no raw prompts/documents/keys logged.

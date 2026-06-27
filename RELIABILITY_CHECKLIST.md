# Harbor — Reliability Checklist

How Harbor preserves work and degrades gracefully. Each item maps to real code.

## Work is never lost
- [x] Autosave to IndexedDB on every change (debounced) — `hooks/useTask.ts`, `lib/db/tasks.ts`.
- [x] Task state persisted at run start, so a refresh mid-task restores the saved context.
- [x] URL is synced to the task id (History API) so refresh/back restores the exact task —
      `components/workspace/Workspace.tsx`.
- [x] Storage-quota errors surface a message instead of silently dropping work; on-screen work stays.
- [x] Export/import a full Harbor JSON backup — `lib/db/tasks.ts`, `/library`.
- [x] Duplicate and Delete (with Undo toast) — `/library`, Workspace toolbar.

## Provider & network resilience
- [x] One repair retry on malformed JSON, then a free-model fallback chain — `task-runner.ts`.
- [x] Transient errors retry at most once; non-retryable (auth) stop immediately; no quota-burning loops.
- [x] AbortController for Cancel; cancellation is honoured server- and client-side.
- [x] Provider outage → plain message, work preserved, Retry without re-uploading.
- [x] Streamed NDJSON stages keep the UI interactive during processing; no indefinite spinners.

## Retrieval safety & limits
- [x] SSRF blocking (protocol/host/IP + DNS resolution) — `validate-url.ts`, `url-shape.ts`.
- [x] Timeouts, content-size cap, content-type checks, manual redirect re-validation — `fetch-url.ts`.
- [x] robots.txt respected; noindex honoured; ≤`MAX_URL_PAGES` crawl; concurrency limited (p-limit).
- [x] Paywalls/login walls detected (401/403) and skipped, not bypassed.
- [x] Extracted text sanitized; scraped HTML never rendered.

## Input & file handling
- [x] Size (≤10 MB) and type checks; ≤6 attachments; friendly messages for oversized/unsupported.
- [x] Scanned PDF with no text layer → explained, routed to manual entry (not fabricated).
- [x] Image OCR low-confidence/failure → preview + editable correction; never invents handwriting.
- [x] Empty input cannot start a task (button disabled).

## Evidence integrity
- [x] A `verified_fact` must cite a real source + excerpt, else it is downgraded — `task-runner.ts`,
      `citation-builder.ts`.
- [x] Sources are only those actually retrieved; demo mode never fabricates citations/URLs/dates.
- [x] User-provided vs public-source vs interpretation kept visually separate.

## Export honesty
- [x] No success state unless a file was actually produced — `lib/client/download.ts`.
- [x] CSV/TSV only offered when a comparison exists; evidence JSON only with claims/sources.
- [x] Print/PDF is self-contained (print-only evidence appendix) and hides app chrome.
- [x] PPTX is not offered (not verified) — no false capability claim.

## Verified
Typecheck ✓ · Lint ✓ · 63 unit ✓ · 17 E2E + axe ✓ · production build ✓.

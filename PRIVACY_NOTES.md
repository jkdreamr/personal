# Harbor — Privacy & Safety Notes

The user-facing version of this lives at `/privacy`. This is the engineering reference.

## Principles

- **Local-first.** Tasks, drafts, attachments, voice profiles, and preferences are stored only in
  the browser (IndexedDB). No account, no server-side user database.
- **Files stay on the device.** PDF/DOCX/EML/image parsing all run in the browser. Only the
  *extracted text* is ever sent to a model — never the original file.
- **Retrieval is server-side and scoped.** Public links are fetched from the server (never a
  logged-in session) with SSRF protection, robots respect, and paywall/login detection.

## What we explicitly do NOT claim
Zero retention · enterprise-grade security · HIPAA / legal / financial compliance · a guarantee
that third parties never see content. The `/privacy` page states this plainly.

## Exact beta warning (shown in-app)
> Harbor is a private beta using free third-party AI providers. Do not upload confidential client
> material, non-public investment information, personal financial records, health records, or
> sensitive legal documents.

## Logging
No raw prompts, document contents, uploaded file contents, API keys, or sensitive metadata are
logged. Processing routes set `Cache-Control: no-store`.

## Prompt-injection defense
Every system prompt states that content under `PROVIDED MATERIAL` and `SOURCES` is untrusted data to
summarize/cite/analyse — never instructions. The model is told to ignore any embedded commands. Only
the application's system instructions control behaviour. Scraped HTML is never rendered; only
sanitized text is used.

## People & sensitive data
Prompts forbid private/sensitive personal data (home address, family, health, finances, political
affiliation) and keep people-related work to public, professional context. Challenge/Verify classify
claims rather than asserting allegations as fact.

## Secrets
`OPENROUTER_API_KEY` and `BETA_SESSION_SECRET` are server-only; only `NEXT_PUBLIC_*` reach the
client bundle. Runtime env validation rejects a missing/weak session secret in production.

## Sensitive-material disclaimer
Explain (and any legal/medical/tax/financial content) shows: *"This is a plain-language summary, not
legal, medical, tax, or financial advice."*

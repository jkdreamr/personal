# Editor Architecture (rich documents)

Harbor's editable prose runs on a **canonical, versioned rich-document model** backed by
ProseMirror/Tiptap. This doc records the decisions; see `lib/richdoc/` and `components/editor/`.

## Why Tiptap v3 / ProseMirror

- React 19 + Next 15.5 App Router compatible (Tiptap v3.27 peer-deps `react: ^19`).
- Mature selection mapping, undo/redo, serialization, decorations, and safe rendering — the rule-6
  requirements that hand-rolled `contenteditable` cannot meet reliably.
- StarterKit v3 already bundles bold/italic/**underline**/strike, headings, bullet/ordered lists
  with list-keymap (Tab/Shift-Tab indentation), blockquote, **link**, code, code block, horizontal
  rule, hard break, and undo/redo. We add: task lists (checklists), math (`@tiptap/extension-mathematics`,
  KaTeX), placeholder, and markdown paste (`tiptap-markdown`).

## Canonical model (`lib/richdoc/`)

- **Source of truth = `RichDoc`** — ProseMirror JSON (`{ version, type:"doc", content }`). NOT HTML,
  NOT a markdown string. JSON preserves formatting markdown can't (underline, checklist state, math)
  and migrates safely (`RICHDOC_VERSION`).
- **Derived views** (`serialize.ts`): `docToMarkdown` / `docToText` are pure, dependency-free,
  deterministic walks over the JSON — usable in exports, copy, AI context, and tests without a DOM.
- **Parsing** (`parse.ts`): `markdownToDoc` runs a short-lived headless Tiptap editor (needs a DOM;
  browser at runtime, jsdom in tests) then post-processes `$...$` / `$$...$$` into math nodes.
- **Migration** (`migrate.ts`): `resolveDoc` precedence is **`doc` → legacy `editedBody` → none**.
  Legacy markdown bodies upgrade on the fly via `markdownToDoc`, so every existing saved task opens
  losslessly with no data loss.

## Storage / backward compatibility

- New `Task.doc?: RichDoc` (canonical). `Task.editedBody` is retained as a **derived markdown cache**
  (`docToMarkdown(doc)`) so existing export / copy / AI-context paths keep working untouched.
- On load: `doc` is preferred; a legacy `editedBody`-only task is migrated to `doc` lazily and
  re-persisted. Dexie stores `doc` as a non-indexed field (a `version(2)` marker documents the change).

## Shared components

- `RichDocumentEditor` (editable) and `RichDocumentRenderer` (read-only) share one extension set
  (`extensions.ts`) so a document renders identically whether being edited or displayed. There is one
  editor implementation, not one per service.

## Safety

- `Markdown.configure({ html: false })` blocks raw HTML injection from pasted/loaded content.
- Links use the default protocol allowlist (no `javascript:`/`data:`) plus `rel="noopener noreferrer
  nofollow"`.
- Invalid LaTeX renders inline via KaTeX `throwOnError:false` — never crashes the document.

## Autocomplete (cursor-anchored)

`lib/richdoc/ghost-text.ts` is a ProseMirror extension that renders the suggestion as a grey widget
decoration **at the caret** (not at the document end), bound to a position and invalidated the moment
the doc changes or the caret moves. Tab accepts (one undoable insert), Esc dismisses; with no ghost,
Tab falls through to list indentation (`priority: 1000`). `components/editor/useGhostText.ts` drives
requests on a short idle debounce, suppressed during IME composition, selection, code/math nodes,
blur, and streaming. Stale requests abort; failures are silent.

It fires at two safe spots after a finished word: the **end of the block**, or a **sentence boundary
mid-block** (after `. `/`? `/`! `) — never mid-word or mid-clause. The mid-block case is **suffix-
aware**: the text after the caret is sent to `/api/autocomplete` (continue BETWEEN before/after), and
the candidate passes through `lib/client/ghost-fit.ts` `fitBeforeSuffix()` — dropped if it duplicates
what already follows, otherwise closed with a separating space so it can't glue onto the next
sentence.

## Writing fonts (per-text)

`lib/client/writing-fonts.ts` defines a small system-only font set (sans/serif/book/mono — zero
downloads, instant render). A `TextStyle` + `FontFamily` mark (`@tiptap/extension-{text-style,
font-family}`) lets the writer apply one of these fonts to *just the current selection* via the
toolbar **Font** dropdown ("Font for the selected text"), or reset it with "Default"
(`unsetFontFamily`). The mark lives in the canonical JSON; the deterministic markdown/text serializers
pass the text through untouched (markdown can't express a font), so exports are unaffected. There is
intentionally **no** document-wide font setting — the app chrome and the document base both use
`--font-sans`.

## Suggest (Grammarly-style editorial suggestions)

A quiet **Suggest** control runs a careful editorial analysis (`/api/suggest`) returning a structured,
Zod-validated contract (`lib/ai/suggest-schema.ts`): each suggestion has an **exact target quote**, a
replacement, a category (clarity / concision / grammar / punctuation / word-choice / tone / style /
flow / repetition / structure / specificity / consistency / **addition**), and a rationale, plus
document-level "overall direction". The prompt asks for a thorough markup (up to 16, de-duped), not
just "the few most valuable"; an **addition** is expressed as a replacement that copies the existing
sentence and appends a new one. It is also **service-aware**: the editing surface sends its service
(write/notes/proposal/…) so `/api/suggest` applies a per-service editorial lens (proposal → credible /
client-first; notes → brief / don't formalize; decide → neutral across options; …).

**Occurrence-safe targeting** is the key correctness property. Each suggestion carries optional
before/after context anchors; `findAnchoredRange` (`lib/richdoc/find-range.ts`) picks the occurrence
whose surroundings match the anchors and **refuses to guess** when a repeated quote stays ambiguous —
so an edit never lands on the wrong sentence. Live tracking trusts **ProseMirror transaction mapping**:
markers follow edits via the `SuggestionMarks` plugin's mapped ranges (no re-search → no jumping), and
a suggestion is stale only when the text under its mapped range no longer equals the target. Accept
replaces exactly that mapped range as one undoable transaction.

`SuggestPanel` lists suggestions with Accept / Dismiss / Refresh — all real buttons (keyboard + touch,
no hover-only). **Hovering** an inline marker pops a `SuggestionHoverCard` anchored to it (the change +
rationale + Accept/Dismiss), with a short close delay so the pointer can travel into the card; it's a
convenience over the panel, never the only path. Demo mode (`lib/ai/demo-suggest.ts`) returns
deterministic local suggestions (with anchors) for testing.

## Editable surfaces beyond prose

Not every result is a single prose document, so two structured surfaces have their own editors that
follow the same "edit persists separately from the regenerated artifact" rule as `doc`/`editedBody`:

- **Slides (Present)** — `components/workspace/SlideDeck.tsx` is a full deck surface: a slide
  navigator (thumbnails, `aria-current`), click-to-edit fields per slide (layout, title, message,
  bullets, speaker notes), add / duplicate / delete / reorder with a 40-step undo history, and two
  full-screen present modes (arrows / space / PageUp-Down navigate, Escape exits): a clean **audience
  view** and a **presenter view** (current + next slide, the slide's speaker notes, an elapsed-time
  clock, and slide position), toggleable in-session. Edits persist to `Task.slides` (preferred over
  `artifact.slides`); regeneration clears them. Print uses a static block — never a nested
  `print-document`.
- **Cover / follow-up email (Proposal, Meeting, Write)** — `ArtifactBody` renders the email body with
  a quiet Edit/Done toggle that swaps to a textarea. Edits persist to `Task.editedEmail` (saved
  immediately, since email edits are infrequent and a refresh right after must not drop them), are
  merged back into the artifact for copy + every export format, and are cleared on regenerate.

## Service surfacing

`components/workspace/Workspace.tsx` shows each service's declared `modes` (lib/services.ts) as quiet,
optional "Common uses" chips on the empty first screen; clicking one fills the goal with a natural
sentence so a non-technical user isn't faced with a blank box. The chips step aside once a goal exists
and are never a required choice.

## Testing

`tests/unit/richdoc.test.ts` (jsdom) covers serialization of every node/mark, markdown round-trips,
checklist round-trips, inline/block math, malformed-input safety, and legacy migration precedence.
`tests/unit/writing-fonts.test.ts` covers font resolution. E2E (`write.spec.ts`, `editing.spec.ts`)
cover toolbar/keyboard formatting, cursor-anchored autocomplete (Tab/Esc + list-indent fallthrough),
the Improve-selection flow (visible highlight + exact replacement), per-text font, and selection word
count. `services.spec.ts` covers the editable Present deck (navigate / edit /
add / delete / undo / present-mode), the editable follow-up email that survives a reload, the
"Common uses" starting-point chips, and a per-service smoke pass (Compare, Challenge, Research,
Explain, Decide, Proposal, Brief, Notes draft entry).

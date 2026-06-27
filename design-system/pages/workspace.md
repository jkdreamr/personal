# Workspace — every service

Inherits MASTER. The shared three-panel pattern that all services render.

## Layout
- **Header bar**: service name · editable task title · save status ("Saved" / "Saving…" /
  "Saved locally just now") · last updated · Copy · Export · Duplicate · Start new · a privacy
  shield button. Copy and Export are always visible on desktop (never hidden in a ⋯ menu).
- **Left — Context (≈320px)**: task goal (the one sentence), attached context (text/files/links
  with type chips), inferred assumptions (labelled), and a collapsed "Adjust this" with ≤3
  likely refinements + the optional controls.
- **Center — Work (flexible, prose max ~720px)**: the artifact. Editable where it makes sense
  (Write/Notes/Brief/etc. drafts are contentEditable-style textareas/rich blocks). Present shows
  the slide deck; Compare shows the table; Verify/Challenge show claim cards.
- **Right — Sources (≈320px)**: source chips, claim checks, uncertainties, open questions, next
  actions. Collapses to a drawer on tablet.

## Processing
- Real stage rail driven by actual execution: Context received → Understanding your material →
  Checking sources → Creating your draft → Ready for review. (Sources stage only when retrieval
  ran.) `aria-live` announces stage changes. UI stays interactive; Cancel + Retry available.
- No fake "thinking" prose, no indefinite spinner. Skeletons where useful.

## Mobile
- Segmented control Context | Work | Sources. Bottom nav Home · Work · Library · Settings.
- Export actions collapse into an overflow only on small screens.

## States
- Empty (first screen), loading (stage rail + skeleton), ready, error (plain-language + Retry,
  work preserved), offline/provider-down ("The free research model is temporarily unavailable.
  Your work is still saved here.").

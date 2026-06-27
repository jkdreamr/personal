# Library — `/library`

Inherits MASTER. Where saved work lives. Local-only, honest, calm.

## Layout
- Simple header: "Library" + one line "Everything you've made stays in this browser until you
  export it."
- A quiet filter row (All · by service group) and a search box. No fake counts or charts.
- A list (not a dense table) of saved tasks: title, service, last updated (relative + tabular
  absolute on hover), a 1-line preview of the artifact. Each row: Open · Duplicate · Export ·
  Delete (delete asks for confirmation; offers Undo via toast).
- Top-right: Import workspace (JSON) and Export all (Harbor JSON backup).
- Empty state: "No saved work yet. Anything you make in Harbor will appear here." with a link
  back to Home.

## Notes
- Rows are keyboard navigable; Open on Enter. Delete is visually separated from safe actions and
  uses the danger label + confirmation.
- Sorting newest-first by default; preserves scroll position on back navigation.

/**
 * Writing fonts. A small, deliberately-chosen set of READABLE typefaces for the document surfaces
 * (rich editor, readable previews, presentations). All are system fonts — zero downloads, instant
 * render — so this never adds weight or destabilizes the app UI (the app chrome keeps --font-sans).
 */
export type WritingFontId = "sans" | "serif" | "book" | "mono";

export const WRITING_FONTS: { id: WritingFontId; label: string; stack: string }[] = [
  { id: "sans", label: "Sans (default)", stack: "var(--font-sans)" },
  { id: "serif", label: "Serif", stack: '"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif' },
  { id: "book", label: "Book", stack: 'Georgia, Cambria, "Times New Roman", Times, serif' },
  { id: "mono", label: "Mono", stack: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace' },
];

export const DEFAULT_WRITING_FONT: WritingFontId = "sans";
export const WRITING_FONT_PREF_KEY = "writingFont";

/** The CSS font-family stack for a font id (falls back to the default for unknown ids). */
export function fontStack(id: string): string {
  return (WRITING_FONTS.find((f) => f.id === id) ?? WRITING_FONTS[0]).stack;
}

/** Apply the writing font globally via a CSS variable consumed by editor/prose surfaces. */
export function applyWritingFont(id: string): void {
  if (typeof document !== "undefined") {
    document.documentElement.style.setProperty("--writing-font", fontStack(id));
  }
}

"use client";

import { Label } from "@/components/ui/field";
import { WRITING_FONTS, type WritingFontId } from "@/lib/client/writing-fonts";
import { useWritingFont } from "./useWritingFont";

/** A compact, accessible writing-font selector for the document settings area. */
export function WritingFontPicker({ id = "writing-font" }: { id?: string }) {
  const { font, setFont } = useWritingFont();
  return (
    <div>
      <Label htmlFor={id} className="text-meta text-muted">
        Writing font
      </Label>
      <select
        id={id}
        value={font}
        onChange={(e) => setFont(e.target.value as WritingFontId)}
        className="mt-1 w-full rounded-btn border border-line bg-surface px-2.5 py-2 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/70"
      >
        {WRITING_FONTS.map((f) => (
          <option key={f.id} value={f.id}>
            {f.label}
          </option>
        ))}
      </select>
    </div>
  );
}

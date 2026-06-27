"use client";

import * as React from "react";
import { getPreference, setPreference } from "@/lib/db/tasks";
import {
  applyWritingFont,
  DEFAULT_WRITING_FONT,
  WRITING_FONT_PREF_KEY,
  type WritingFontId,
} from "@/lib/client/writing-fonts";

/**
 * Loads the persisted writing font, applies it globally (CSS variable), and persists changes. The
 * preference survives refresh, restored tasks, print, and presentation mode because it is stored in
 * the existing local preferences store and applied at the document root.
 */
export function useWritingFont() {
  const [font, setFontState] = React.useState<WritingFontId>(DEFAULT_WRITING_FONT);

  React.useEffect(() => {
    let active = true;
    getPreference<WritingFontId>(WRITING_FONT_PREF_KEY, DEFAULT_WRITING_FONT).then((f) => {
      if (!active) return;
      setFontState(f);
      applyWritingFont(f);
    });
    return () => {
      active = false;
    };
  }, []);

  const setFont = React.useCallback((f: WritingFontId) => {
    setFontState(f);
    applyWritingFont(f);
    setPreference(WRITING_FONT_PREF_KEY, f).catch(() => {});
  }, []);

  return { font, setFont };
}

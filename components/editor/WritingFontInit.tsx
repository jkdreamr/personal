"use client";

import { useWritingFont } from "./useWritingFont";

/** Applies the persisted writing font globally on every app page. Renders nothing. */
export function WritingFontInit() {
  useWritingFont();
  return null;
}

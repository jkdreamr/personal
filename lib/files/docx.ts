"use client";

/** DOCX → readable text using mammoth (browser build). Headings/lists are preserved as text. */
export async function extractDocx(file: File): Promise<{ text: string }> {
  const mammoth = await import("mammoth/mammoth.browser");
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return { text: (result.value ?? "").replace(/\n{3,}/g, "\n\n").trim() };
}

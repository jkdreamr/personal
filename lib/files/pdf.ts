"use client";

/**
 * Client-side PDF text extraction with pdfjs-dist. Text is extracted page by page and
 * page references are preserved. The file never leaves the browser. Scanned PDFs with no
 * text layer return little/no text — the caller then offers OCR or manual entry.
 */
export type PdfExtraction = { text: string; pages: number; perPage: string[] };

export async function extractPdf(file: File): Promise<PdfExtraction> {
  const pdfjs = await import("pdfjs-dist");
  // Bundled worker (webpack resolves this asset URL). Falls back gracefully if unavailable.
  try {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  } catch {
    /* worker may already be configured */
  }

  const data = new Uint8Array(await file.arrayBuffer());
  const loadingTask = pdfjs.getDocument({ data });
  const pdf = await loadingTask.promise;
  const perPage: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const strings = content.items.map((it) => ("str" in it ? (it as { str: string }).str : "")).join(" ");
    perPage.push(strings.replace(/\s+/g, " ").trim());
  }
  await pdf.destroy();
  const text = perPage.map((t, i) => (t ? `[Page ${i + 1}] ${t}` : "")).filter(Boolean).join("\n\n");
  return { text, pages: pdf.numPages, perPage };
}

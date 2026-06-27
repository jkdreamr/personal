"use client";

/**
 * Local OCR with tesseract.js. The image never leaves the browser. We return the text plus
 * a confidence so the UI can highlight low-confidence results and ask the user to confirm —
 * Harbor never fabricates unreadable handwriting.
 *
 * In demo/offline mode (NEXT_PUBLIC_DEMO_MODE=true) we skip the network-dependent OCR engine
 * and return an empty low-confidence result, which routes the user to manual correction.
 */
export type OcrResult = { text: string; confidence: number; lowConfidence: boolean; failed: boolean };

const DEMO = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

export async function runOcr(file: File, onProgress?: (p: number) => void): Promise<OcrResult> {
  if (DEMO) {
    onProgress?.(1);
    return { text: "", confidence: 0, lowConfidence: true, failed: false };
  }
  try {
    const Tesseract = (await import("tesseract.js")).default;
    const { data } = await Tesseract.recognize(file, "eng", {
      logger: (m: { status?: string; progress?: number }) => {
        if (m.status === "recognizing text" && typeof m.progress === "number") onProgress?.(m.progress);
      },
    });
    const text = (data.text ?? "").replace(/\n{3,}/g, "\n\n").trim();
    const confidence = typeof data.confidence === "number" ? data.confidence / 100 : 0;
    return { text, confidence, lowConfidence: confidence < 0.7 || text.length < 8, failed: false };
  } catch {
    return { text: "", confidence: 0, lowConfidence: true, failed: true };
  }
}

/** A local object URL preview for an image (revoke when done). */
export async function imagePreview(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read the image."));
    reader.readAsDataURL(file);
  });
}

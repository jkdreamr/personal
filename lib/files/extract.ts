"use client";

import type { Attachment } from "@/lib/types";
import { uid } from "@/lib/utils";

export const ACCEPTED_EXTENSIONS = [".pdf", ".docx", ".eml", ".txt", ".md", ".markdown", ".png", ".jpg", ".jpeg"];
export const ACCEPTED_ACCEPT_ATTR =
  ".pdf,.docx,.eml,.txt,.md,.markdown,.png,.jpg,.jpeg,application/pdf,text/plain,text/markdown,message/rfc822,image/png,image/jpeg";

export type ExtractProgress = (stage: string, progress?: number) => void;

function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i === -1 ? "" : name.slice(i).toLowerCase();
}

export function isImage(file: File): boolean {
  return file.type.startsWith("image/") || [".png", ".jpg", ".jpeg"].includes(extOf(file.name));
}

export type ExtractResult = { attachment: Attachment; needsReview: boolean };

/**
 * Extract an Attachment from a File entirely in the browser. Returns `needsReview: true`
 * for images and low-confidence OCR so the UI can show the extracted text for confirmation.
 * Throws a friendly Error for oversized/unsupported/corrupt files.
 */
export async function extractFile(file: File, maxBytes: number, onProgress?: ExtractProgress): Promise<ExtractResult> {
  if (file.size > maxBytes) {
    throw new Error(`"${file.name}" is larger than the ${Math.round(maxBytes / 1_000_000)} MB limit. Try a smaller file or paste the text.`);
  }
  const ext = extOf(file.name);
  const baseMeta = { bytes: file.size };

  try {
    if (ext === ".pdf" || file.type === "application/pdf") {
      onProgress?.("Reading the PDF");
      const { extractPdf } = await import("./pdf");
      const { text, pages } = await extractPdf(file);
      if (text.trim().length < 10) {
        // Likely a scanned PDF — be honest rather than returning nothing.
        return {
          attachment: {
            id: uid("att"),
            kind: "file",
            label: file.name,
            mime: "application/pdf",
            text: "",
            meta: { ...baseMeta, pages, error: "This PDF has no readable text layer (it may be scanned). Paste the text or upload a clearer file." },
          },
          needsReview: true,
        };
      }
      return { attachment: { id: uid("att"), kind: "file", label: file.name, mime: "application/pdf", text, meta: { ...baseMeta, pages } }, needsReview: false };
    }

    if (ext === ".docx") {
      onProgress?.("Reading the document");
      const { extractDocx } = await import("./docx");
      const { text } = await extractDocx(file);
      return { attachment: { id: uid("att"), kind: "file", label: file.name, mime: file.type, text, meta: baseMeta }, needsReview: false };
    }

    if (ext === ".eml" || file.type === "message/rfc822") {
      onProgress?.("Reading the email");
      const { parseEml } = await import("./eml");
      const parsed = await parseEml(file);
      return { attachment: { id: uid("att"), kind: "file", label: parsed.subject ? `Email: ${parsed.subject}` : file.name, mime: "message/rfc822", text: parsed.text, meta: baseMeta }, needsReview: false };
    }

    if (ext === ".txt" || ext === ".md" || ext === ".markdown" || file.type.startsWith("text/")) {
      const text = (await file.text()).slice(0, 200_000);
      return { attachment: { id: uid("att"), kind: "file", label: file.name, mime: file.type || "text/plain", text, meta: baseMeta }, needsReview: false };
    }

    if (isImage(file)) {
      onProgress?.("Reading the image", 0);
      const { runOcr, imagePreview } = await import("./ocr");
      const preview = await imagePreview(file).catch(() => undefined);
      const ocr = await runOcr(file, (p) => onProgress?.("Reading the image", p));
      return {
        attachment: {
          id: uid("att"),
          kind: "file",
          label: file.name,
          mime: file.type || "image/*",
          text: ocr.text,
          meta: {
            ...baseMeta,
            ocr: true,
            ocrConfidence: ocr.confidence,
            lowConfidence: ocr.lowConfidence,
            previewDataUrl: preview,
            error: ocr.failed ? "Harbor couldn't read this image automatically. Type or correct the text below." : undefined,
          },
        },
        // Always let the user confirm text from an image.
        needsReview: true,
      };
    }

    throw new Error(`Harbor can't read "${file.name}" yet. Supported: PDF, DOCX, EML, TXT, Markdown, PNG, JPG.`);
  } catch (err) {
    if (err instanceof Error && /larger than|can't read|no readable/.test(err.message)) throw err;
    throw new Error(`Harbor couldn't read "${file.name}". It may be corrupt or password-protected — try another file or paste the text.`);
  }
}

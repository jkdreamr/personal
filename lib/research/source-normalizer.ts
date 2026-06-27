import type { Source } from "@/lib/types";
import { uid } from "@/lib/utils";
import type { ExtractedContent } from "./extract-readable-content";
import { classifyTrust } from "./trust-tier";

/** Convert extracted page content into a typed Source with a trust tier + timestamp. */
export function toSource(
  page: { url: string; finalUrl?: string },
  extracted: ExtractedContent,
  opts?: { primaryDomain?: string }
): Source {
  const canonicalUrl = page.finalUrl ?? page.url;
  let publisher: string | undefined;
  try {
    publisher = new URL(canonicalUrl).hostname.replace(/^www\./, "");
  } catch {
    publisher = undefined;
  }
  return {
    id: uid("src"),
    title: extracted.title || canonicalUrl,
    canonicalUrl,
    publisher,
    retrievedAt: new Date().toISOString(),
    publishedAt: extracted.publishedAt,
    trustTier: classifyTrust(canonicalUrl, opts),
    excerpt: extracted.excerpt,
    content: extracted.text.slice(0, 8000),
  };
}

/** Make a user-provided pasted-text item into a source (no URL). */
export function pastedTextSource(label: string, text: string): Source {
  return {
    id: uid("src"),
    title: label,
    retrievedAt: new Date().toISOString(),
    trustTier: "user_provided",
    excerpt: text.slice(0, 320).replace(/\s+/g, " ").trim(),
    content: text.slice(0, 8000),
  };
}

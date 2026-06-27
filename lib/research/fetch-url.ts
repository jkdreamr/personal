import { ROBOTS_UA } from "./robots";
import { validateUrl } from "./validate-url";

/**
 * Safe server-side fetch of a single public page.
 * - Re-validates the URL (and every redirect hop) against SSRF rules.
 * - Enforces a timeout and a content-size cap.
 * - Only accepts HTML/text content types.
 */

const MAX_BYTES = 2_500_000; // 2.5 MB
const TIMEOUT_MS = 12_000;
const MAX_REDIRECTS = 4;

export type FetchedPage =
  | { ok: true; url: string; finalUrl: string; status: number; contentType: string; html: string }
  | { ok: false; url: string; reason: string };

function isHtmlLike(contentType: string): boolean {
  const ct = contentType.toLowerCase();
  return ct.includes("text/html") || ct.includes("application/xhtml") || ct.includes("text/plain") || ct === "";
}

async function readCapped(res: Response): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return await res.text();
  const decoder = new TextDecoder();
  let received = 0;
  let out = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    out += decoder.decode(value, { stream: true });
    if (received > MAX_BYTES) {
      await reader.cancel();
      break;
    }
  }
  out += decoder.decode();
  return out;
}

export async function fetchPage(rawUrl: string, signal?: AbortSignal): Promise<FetchedPage> {
  let current = rawUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const check = await validateUrl(current);
    if (!check.ok) return { ok: false, url: rawUrl, reason: check.reason };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    if (signal) {
      if (signal.aborted) controller.abort();
      else signal.addEventListener("abort", () => controller.abort(), { once: true });
    }

    let res: Response;
    try {
      res = await fetch(check.url.toString(), {
        headers: {
          "User-Agent": ROBOTS_UA,
          Accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.1",
        },
        redirect: "manual",
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timer);
      const aborted = err instanceof Error && err.name === "AbortError";
      return { ok: false, url: rawUrl, reason: aborted ? "The page took too long to respond." : "The page could not be reached." };
    }
    clearTimeout(timer);

    // Manual redirect handling so each hop is re-validated.
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) return { ok: false, url: rawUrl, reason: "The page redirected without a destination." };
      current = new URL(loc, check.url).toString();
      continue;
    }

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        return { ok: false, url: rawUrl, reason: "This page is behind a login or paywall and was not accessed." };
      }
      return { ok: false, url: rawUrl, reason: `The page returned ${res.status}.` };
    }

    const contentType = res.headers.get("content-type") ?? "";
    if (!isHtmlLike(contentType)) {
      return { ok: false, url: rawUrl, reason: "That link isn't a readable web page." };
    }

    const html = await readCapped(res);
    return { ok: true, url: rawUrl, finalUrl: check.url.toString(), status: res.status, contentType, html };
  }
  return { ok: false, url: rawUrl, reason: "The page redirected too many times." };
}

import * as cheerio from "cheerio";
import { validateUrlShape } from "./url-shape";
import type { SearchAdapter, SearchHit } from "./search-adapter";

/**
 * A free, key-less web search adapter using DuckDuckGo's HTML endpoints. No paid provider.
 * Results are public-page links + snippets; the caller fetches the top results through the
 * existing SSRF-safe pipeline before anything reaches a model. Best-effort: DDG may rate-limit
 * or change markup, in which case we return fewer/zero hits and say so honestly downstream.
 */

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

function decodeDdgHref(href: string): string | null {
  try {
    // DDG wraps results as //duckduckgo.com/l/?uddg=<encoded-url>&...
    const u = href.startsWith("//") ? new URL("https:" + href) : new URL(href, "https://duckduckgo.com");
    if (u.pathname.includes("/l/")) {
      const real = u.searchParams.get("uddg");
      if (real) return decodeURIComponent(real);
    }
    if (u.protocol === "http:" || u.protocol === "https:") return u.toString();
    return null;
  } catch {
    return null;
  }
}

async function fetchHtml(url: string, signal: AbortSignal | undefined, body?: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 9000);
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener("abort", () => controller.abort(), { once: true });
  }
  try {
    const res = await fetch(url, {
      method: body ? "POST" : "GET",
      headers: {
        "User-Agent": UA,
        Accept: "text/html",
        ...(body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
      },
      body,
      signal: controller.signal,
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export function parseResults(html: string, limit: number): SearchHit[] {
  const $ = cheerio.load(html);
  const hits: SearchHit[] = [];
  const seen = new Set<string>();

  const push = (rawHref: string | undefined, title: string, snippet: string) => {
    if (!rawHref) return;
    const real = decodeDdgHref(rawHref);
    if (!real) return;
    const shape = validateUrlShape(real);
    if (!shape.ok) return;
    let key: string;
    try {
      const u = shape.url;
      key = u.hostname.replace(/^www\./, "") + u.pathname;
    } catch {
      return;
    }
    if (seen.has(key)) return;
    seen.add(key);
    hits.push({ url: shape.url.toString(), title: title.trim() || undefined, snippet: snippet.trim() || undefined });
  };

  // html.duckduckgo.com markup
  $(".result__body, .web-result").each((_, el) => {
    if (hits.length >= limit) return;
    const a = $(el).find("a.result__a").first();
    push(a.attr("href"), a.text(), $(el).find(".result__snippet").first().text());
  });

  // lite.duckduckgo.com fallback markup (table of links)
  if (hits.length === 0) {
    $("a.result-link, a[rel='nofollow']").each((_, el) => {
      if (hits.length >= limit) return;
      const a = $(el);
      push(a.attr("href"), a.text(), "");
    });
  }

  return hits.slice(0, limit);
}

export const duckDuckGoAdapter: SearchAdapter = {
  name: "duckduckgo",
  enabled: true,
  async search(query: string, signal?: AbortSignal): Promise<SearchHit[]> {
    const q = query.trim().slice(0, 300);
    if (!q) return [];
    const encoded = encodeURIComponent(q);
    // Try the HTML endpoint, then the lite endpoint.
    const html = await fetchHtml(`https://html.duckduckgo.com/html/?q=${encoded}&kl=us-en`, signal);
    let hits = html ? parseResults(html, 6) : [];
    if (hits.length === 0) {
      const lite = await fetchHtml("https://lite.duckduckgo.com/lite/", signal, `q=${encoded}`);
      if (lite) hits = parseResults(lite, 6);
    }
    return hits;
  },
};

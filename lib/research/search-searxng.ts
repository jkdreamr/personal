import * as cheerio from "cheerio";
import { serverEnv } from "@/lib/env";
import { validateUrlShape } from "./url-shape";
import type { SearchAdapter, SearchHit } from "./search-adapter";

/**
 * SearXNG adapter — the unlimited, $0 web-search path. SearXNG is open-source metasearch
 * (it aggregates Google/Bing/DuckDuckGo/etc. server-side). Point SEARXNG_URL at an instance
 * you control (self-hosted in ~1 command) and Harbor gets full-web results with no query cap
 * and no per-query cost. Public instances block datacenter IPs, so a self-hosted/owned instance
 * is the reliable choice. Tries the JSON API first, then falls back to scraping the HTML page.
 */

const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

function take(hits: SearchHit[], rawUrl: string, title?: string, snippet?: string, seen?: Set<string>): void {
  const shape = validateUrlShape(rawUrl);
  if (!shape.ok) return;
  const key = shape.url.hostname.replace(/^www\./, "") + shape.url.pathname;
  if (seen) {
    if (seen.has(key)) return;
    seen.add(key);
  }
  hits.push({ url: shape.url.toString(), title: title?.trim() || undefined, snippet: snippet?.trim() || undefined });
}

async function fetchInstance(path: string, signal: AbortSignal | undefined): Promise<Response | null> {
  const base = serverEnv.searxngUrl.replace(/\/$/, "");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener("abort", () => controller.abort(), { once: true });
  }
  try {
    return await fetch(base + path, {
      headers: { "User-Agent": UA, Accept: "application/json, text/html" },
      signal: controller.signal,
    });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function parseSearxngHtml(html: string, limit: number): SearchHit[] {
  const $ = cheerio.load(html);
  const hits: SearchHit[] = [];
  const seen = new Set<string>();
  $("article.result, .result").each((_, el) => {
    if (hits.length >= limit) return;
    const a = $(el).find("a.url_header, h3 a, a[href^='http']").first();
    const href = a.attr("href");
    if (!href) return;
    take(hits, href, a.text() || $(el).find("h3").first().text(), $(el).find(".content, p.content").first().text(), seen);
  });
  return hits.slice(0, limit);
}

export const searxngAdapter: SearchAdapter = {
  name: "searxng",
  get enabled() {
    return serverEnv.searxngUrl.length > 0;
  },
  async search(query: string, signal?: AbortSignal): Promise<SearchHit[]> {
    const q = query.trim().slice(0, 380);
    if (!serverEnv.searxngUrl || !q) return [];
    const params = new URLSearchParams({ q, safesearch: "1", language: "en" });

    // 1) JSON API (preferred — needs `formats: [json]` in the instance settings).
    const jsonRes = await fetchInstance(`/search?${params.toString()}&format=json`, signal);
    if (jsonRes && jsonRes.ok) {
      const ct = jsonRes.headers.get("content-type") ?? "";
      if (ct.includes("application/json")) {
        try {
          const data = (await jsonRes.json()) as { results?: { url: string; title?: string; content?: string }[] };
          const hits: SearchHit[] = [];
          const seen = new Set<string>();
          for (const r of data.results ?? []) {
            if (hits.length >= 6) break;
            take(hits, r.url, r.title, r.content, seen);
          }
          if (hits.length) return hits;
        } catch {
          /* fall through to HTML */
        }
      }
    }

    // 2) HTML fallback (works even when the JSON format is disabled).
    const htmlRes = await fetchInstance(`/search?${params.toString()}`, signal);
    if (htmlRes && htmlRes.ok) {
      try {
        return parseSearxngHtml(await htmlRes.text(), 6);
      } catch {
        return [];
      }
    }
    return [];
  },
};

export { parseSearxngHtml };

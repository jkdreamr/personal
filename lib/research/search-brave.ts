import { serverEnv } from "@/lib/env";
import { validateUrlShape } from "./url-shape";
import type { SearchAdapter, SearchHit } from "./search-adapter";

/**
 * Brave Search adapter — real full-web results. Brave offers a free tier (no cost), but it
 * needs a key (BRAVE_SEARCH_API_KEY). When the key is present this is preferred over Wikipedia,
 * because it can answer niche questions a search engine block or an encyclopedia can't.
 */
export function braveEnabled(): boolean {
  return serverEnv.braveSearchKey.length > 0;
}

export const braveAdapter: SearchAdapter = {
  name: "brave",
  get enabled() {
    return braveEnabled();
  },
  async search(query: string, signal?: AbortSignal): Promise<SearchHit[]> {
    const key = serverEnv.braveSearchKey;
    const q = query.trim().slice(0, 380);
    if (!key || !q) return [];
    const url = "https://api.search.brave.com/res/v1/web/search?" + new URLSearchParams({ q, count: "6" }).toString();

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    if (signal) {
      if (signal.aborted) controller.abort();
      else signal.addEventListener("abort", () => controller.abort(), { once: true });
    }
    try {
      const res = await fetch(url, {
        headers: { Accept: "application/json", "Accept-Encoding": "gzip", "X-Subscription-Token": key },
        signal: controller.signal,
      });
      if (!res.ok) return [];
      const data = (await res.json()) as { web?: { results?: { url: string; title?: string; description?: string }[] } };
      const hits: SearchHit[] = [];
      for (const r of data.web?.results ?? []) {
        if (hits.length >= 6) break;
        const shape = validateUrlShape(r.url);
        if (!shape.ok) continue;
        hits.push({ url: shape.url.toString(), title: r.title, snippet: r.description });
      }
      return hits;
    } catch {
      return [];
    } finally {
      clearTimeout(timer);
    }
  },
};

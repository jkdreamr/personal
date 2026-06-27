import type { SearchAdapter, SearchHit } from "./search-adapter";

/**
 * Wikipedia / Wikimedia search. Free, key-less, and reliable from a server (unlike scraping a
 * consumer search engine, which blocks datacenter IPs). Good for encyclopedic questions —
 * companies, public figures, topics, definitions, events. Niche facts may not be covered; for
 * full web coverage set BRAVE_SEARCH_API_KEY (see search-brave.ts).
 */
function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, "").replace(/&[a-z]+;/g, " ").trim();
}

export const wikipediaAdapter: SearchAdapter = {
  name: "wikipedia",
  enabled: true,
  async search(query: string, signal?: AbortSignal): Promise<SearchHit[]> {
    const q = query.trim().slice(0, 300);
    if (!q) return [];
    const url =
      "https://en.wikipedia.org/w/api.php?" +
      new URLSearchParams({
        action: "query",
        list: "search",
        srsearch: q,
        srlimit: "5",
        srprop: "snippet",
        format: "json",
        origin: "*",
      }).toString();

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    if (signal) {
      if (signal.aborted) controller.abort();
      else signal.addEventListener("abort", () => controller.abort(), { once: true });
    }
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "HarborBot/1.0 (https://harbor.app)", Accept: "application/json" },
        signal: controller.signal,
      });
      if (!res.ok) return [];
      const data = (await res.json()) as { query?: { search?: { title: string; snippet?: string }[] } };
      return (data.query?.search ?? []).slice(0, 5).map((r) => ({
        url: `https://en.wikipedia.org/wiki/${encodeURIComponent(r.title.replace(/ /g, "_"))}`,
        title: r.title,
        snippet: r.snippet ? stripHtml(r.snippet) : undefined,
      }));
    } catch {
      return [];
    } finally {
      clearTimeout(timer);
    }
  },
};

/**
 * Pluggable search adapter. Broad external web search is DISABLED by default (no paid
 * provider, no fake coverage). Harbor works from user-supplied URLs and pages it can reach.
 * A future adapter can implement this interface without changing the rest of the app.
 */

import { serverEnv } from "@/lib/env";
import { duckDuckGoAdapter } from "./search-duckduckgo";
import { wikipediaAdapter } from "./search-wikipedia";
import { braveAdapter, braveEnabled } from "./search-brave";
import { searxngAdapter } from "./search-searxng";

export type SearchHit = { url: string; title?: string; snippet?: string };

export interface SearchAdapter {
  name: string;
  enabled: boolean;
  search(query: string, signal?: AbortSignal): Promise<SearchHit[]>;
}

/** The default adapter: explicitly does nothing, and says so. */
export const noopSearchAdapter: SearchAdapter = {
  name: "none",
  enabled: false,
  async search() {
    return [];
  },
};

/**
 * Compose adapters with ordered fallback: try each in turn, return the first that yields
 * results. Always reliable because the last adapter (Wikipedia) is key-less and works from a
 * server. With SEARXNG_URL set, the first adapter gives unlimited full-web results at $0.
 */
function compositeAdapter(adapters: SearchAdapter[]): SearchAdapter {
  const active = adapters.filter((a) => a.enabled);
  return {
    name: active.map((a) => a.name).join("+") || "none",
    enabled: active.length > 0,
    async search(query, signal) {
      for (const a of active) {
        try {
          const hits = await a.search(query, signal);
          if (hits.length > 0) return hits;
        } catch {
          /* try the next adapter */
        }
      }
      return [];
    },
  };
}

export function getSearchAdapter(): SearchAdapter {
  switch (serverEnv.searchProvider) {
    case "none":
      return noopSearchAdapter;
    case "wikipedia":
      return wikipediaAdapter;
    case "brave":
      return compositeAdapter([braveAdapter, wikipediaAdapter]);
    case "searxng":
      return compositeAdapter([searxngAdapter, wikipediaAdapter]);
    case "duckduckgo":
      return duckDuckGoAdapter; // explicit opt-in; usually blocked from servers
    case "auto":
    default:
      // Unlimited self-hosted SearXNG first (when configured), then Brave (free tier), then
      // key-less Wikipedia — so search always returns something, at $0.
      return compositeAdapter([searxngAdapter, braveAdapter, wikipediaAdapter]);
  }
}

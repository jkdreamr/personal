/**
 * Pluggable search adapter. Broad external web search is DISABLED by default (no paid
 * provider, no fake coverage). Harbor works from user-supplied URLs and pages it can reach.
 * A future adapter can implement this interface without changing the rest of the app.
 */

import { serverEnv } from "@/lib/env";
import { duckDuckGoAdapter } from "./search-duckduckgo";
import { wikipediaAdapter } from "./search-wikipedia";
import { braveAdapter, braveEnabled } from "./search-brave";

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

export function getSearchAdapter(): SearchAdapter {
  switch (serverEnv.searchProvider) {
    case "none":
      return noopSearchAdapter;
    case "wikipedia":
      return wikipediaAdapter;
    case "brave":
      return braveAdapter;
    case "duckduckgo":
      return duckDuckGoAdapter; // explicit opt-in; usually blocked from servers
    case "auto":
    default:
      // Prefer real web search (Brave) when a key is configured; else key-less Wikipedia.
      return braveEnabled() ? braveAdapter : wikipediaAdapter;
  }
}

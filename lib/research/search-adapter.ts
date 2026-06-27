/**
 * Pluggable search adapter. Broad external web search is DISABLED by default (no paid
 * provider, no fake coverage). Harbor works from user-supplied URLs and pages it can reach.
 * A future adapter can implement this interface without changing the rest of the app.
 */

import { serverEnv } from "@/lib/env";

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
  // Only "none" is wired up in V1. Other providers can be added here behind env config.
  switch (serverEnv.searchProvider) {
    case "none":
    default:
      return noopSearchAdapter;
  }
}

import type { TrustTier } from "@/lib/types";

/**
 * Heuristic trust tier for a fetched page. This is intentionally conservative and
 * transparent — it never claims certainty, it just helps the reader weigh a source.
 */

const REPUTABLE = [
  "reuters.com", "apnews.com", "bbc.co.uk", "bbc.com", "nytimes.com", "wsj.com", "ft.com",
  "bloomberg.com", "economist.com", "theguardian.com", "washingtonpost.com", "npr.org",
  "nature.com", "science.org", "sec.gov", "europa.eu", "gov.uk", "who.int",
];

const TRADE = [
  "techcrunch.com", "theinformation.com", "venturebeat.com", "crunchbase.com", "pitchbook.com",
  "businessinsider.com", "forbes.com", "cnbc.com", "axios.com", "theverge.com", "wired.com",
];

const COMMUNITY = [
  "medium.com", "substack.com", "reddit.com", "quora.com", "wordpress.com", "blogspot.com",
  "wikipedia.org", "x.com", "twitter.com", "linkedin.com", "facebook.com", "youtube.com",
];

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

function endsWithAny(host: string, list: string[]): boolean {
  return list.some((d) => host === d || host.endsWith(`.${d}`));
}

/**
 * Classify a source. `isPrimaryDomain` marks pages on the subject's own official site
 * (the user-supplied company URL), which are primary for facts about themselves.
 */
export function classifyTrust(url: string | undefined, opts?: { primaryDomain?: string }): TrustTier {
  if (!url) return "user_provided";
  const host = hostOf(url);
  if (!host) return "user_provided";

  if (opts?.primaryDomain) {
    const pd = opts.primaryDomain.toLowerCase().replace(/^www\./, "");
    if (host === pd || host.endsWith(`.${pd}`)) return "primary";
  }
  if (host.endsWith(".gov") || host.endsWith(".edu") || endsWithAny(host, REPUTABLE)) return "reputable_reporting";
  if (endsWithAny(host, TRADE)) return "trade_press";
  if (endsWithAny(host, COMMUNITY)) return "community";
  // Unknown domains default to community-level confidence.
  return "community";
}

export const TRUST_TIER_LABELS: Record<TrustTier, string> = {
  primary: "Primary source",
  reputable_reporting: "Reputable reporting",
  trade_press: "Trade press",
  community: "Community / blog",
  user_provided: "You provided this",
};

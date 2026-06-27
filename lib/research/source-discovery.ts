/**
 * Decide which same-domain pages are worth reading for a briefing. We favour the pages
 * that carry real, citable facts (About, Product, Pricing, Team, Press, News, etc.) and
 * cap the count. Sitemap discovery is attempted but optional.
 */

const PRIORITY_PATTERNS: { re: RegExp; weight: number }[] = [
  { re: /\/(about|company|who-we-are|our-story)\b/i, weight: 10 },
  { re: /\/(product|products|solutions|features|platform|services)\b/i, weight: 9 },
  { re: /\/(pricing|plans)\b/i, weight: 8 },
  { re: /\/(team|people|leadership|management)\b/i, weight: 8 },
  { re: /\/(press|news|newsroom|media)\b/i, weight: 7 },
  { re: /\/(investor|investors|ir)\b/i, weight: 7 },
  { re: /\/(careers|jobs)\b/i, weight: 5 },
  { re: /\/(blog|insights|resources)\b/i, weight: 4 },
  { re: /\/(legal|terms|privacy)\b/i, weight: 3 },
  { re: /\/(contact)\b/i, weight: 2 },
];

function score(url: string): number {
  let s = 0;
  for (const { re, weight } of PRIORITY_PATTERNS) if (re.test(url)) s = Math.max(s, weight);
  // Penalize deep / parameterized / asset-ish URLs.
  const depth = new URL(url).pathname.split("/").filter(Boolean).length;
  if (depth > 3) s -= 2;
  if (/\.(pdf|jpg|png|zip|mp4|css|js)$/i.test(url)) s -= 10;
  if (url.includes("?")) s -= 1;
  return s;
}

/** Rank and de-duplicate candidate links, returning the top `limit`. */
export function rankDiscoveredLinks(seedUrl: string, links: string[], limit: number): string[] {
  const seen = new Set<string>();
  const scored: { url: string; s: number }[] = [];
  let seedOrigin = "";
  try {
    seedOrigin = new URL(seedUrl).origin;
  } catch {
    return [];
  }
  for (const raw of links) {
    let norm: string;
    try {
      const u = new URL(raw);
      if (u.origin !== seedOrigin) continue;
      u.hash = "";
      norm = u.toString().replace(/\/$/, "");
    } catch {
      continue;
    }
    if (norm === seedUrl.replace(/\/$/, "")) continue;
    if (seen.has(norm)) continue;
    seen.add(norm);
    scored.push({ url: norm, s: score(norm) });
  }
  return scored
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map((x) => x.url);
}

/** Try to read a sitemap for additional URLs. Best-effort, never throws. */
export async function fetchSitemapUrls(origin: string, signal?: AbortSignal): Promise<string[]> {
  try {
    const res = await fetch(`${origin}/sitemap.xml`, { headers: { "User-Agent": "HarborBot" }, signal });
    if (!res.ok) return [];
    const xml = await res.text();
    const urls = Array.from(xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)).map((m) => m[1]);
    return urls.slice(0, 100);
  } catch {
    return [];
  }
}

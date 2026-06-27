import pLimit from "p-limit";
import type { Source } from "@/lib/types";
import { serverEnv } from "@/lib/env";
import { extractReadable } from "./extract-readable-content";
import { fetchPage } from "./fetch-url";
import { getRobots, isAllowedByRobots } from "./robots";
import { fetchSitemapUrls, rankDiscoveredLinks } from "./source-discovery";
import { toSource } from "./source-normalizer";
import { validateUrl } from "./validate-url";

export type RetrievalLogEntry = { url: string; ok: boolean; reason?: string };
export type RetrievalResult = { sources: Source[]; log: RetrievalLogEntry[]; primaryDomain?: string };

const CONCURRENCY = 3;

/**
 * Retrieve content for a research task.
 * - Each user-supplied URL is fetched (the user asked for it; still SSRF/robots-checked).
 * - For a single company URL, discover and crawl up to MAX_URL_PAGES same-domain pages.
 * - Respects robots.txt, dedupes, records timestamps, caps page count + size.
 */
export async function retrieveSources(urls: string[], signal?: AbortSignal): Promise<RetrievalResult> {
  const log: RetrievalLogEntry[] = [];
  const sources: Source[] = [];
  const limit = pLimit(CONCURRENCY);
  const maxPages = serverEnv.maxUrlPages;

  const cleanUrls = Array.from(new Set(urls.map((u) => u.trim()).filter(Boolean)));
  if (cleanUrls.length === 0) return { sources, log };

  // Determine the primary domain (for trust tiering) when a single site is given.
  let primaryDomain: string | undefined;
  if (cleanUrls.length === 1) {
    try {
      primaryDomain = new URL(cleanUrls[0]).hostname.replace(/^www\./, "");
    } catch {
      /* ignore */
    }
  }

  // 1. Fetch each user-supplied URL.
  const seedPages = await Promise.all(
    cleanUrls.map((u) =>
      limit(async () => {
        const page = await fetchPage(u, signal);
        return { u, page };
      })
    )
  );

  const discovered: string[] = [];
  for (const { u, page } of seedPages) {
    if (!page.ok) {
      log.push({ url: u, ok: false, reason: page.reason });
      continue;
    }
    const extracted = extractReadable(page.html, page.finalUrl);
    sources.push(toSource(page, extracted, { primaryDomain }));
    log.push({ url: u, ok: true });
    discovered.push(...extracted.links);
  }

  // 2. Single-site briefing: discover and crawl additional same-domain pages.
  if (cleanUrls.length === 1 && sources.length > 0 && sources.length < maxPages) {
    const seed = cleanUrls[0];
    let origin = "";
    try {
      origin = new URL(seed).origin;
    } catch {
      origin = "";
    }
    if (origin) {
      const robots = await getRobots(origin, signal);
      const sitemap = await fetchSitemapUrls(origin, signal);
      const ranked = rankDiscoveredLinks(seed, [...discovered, ...sitemap], maxPages * 2);
      const toCrawl: string[] = [];
      const already = new Set(sources.map((s) => s.canonicalUrl?.replace(/\/$/, "")));
      for (const url of ranked) {
        if (sources.length + toCrawl.length >= maxPages) break;
        if (already.has(url.replace(/\/$/, ""))) continue;
        let pathname = "/";
        try {
          pathname = new URL(url).pathname;
        } catch {
          continue;
        }
        if (!isAllowedByRobots(robots, pathname)) {
          log.push({ url, ok: false, reason: "Blocked by robots.txt" });
          continue;
        }
        const check = await validateUrl(url);
        if (!check.ok) continue;
        toCrawl.push(url);
      }

      const crawled = await Promise.all(
        toCrawl.map((url) =>
          limit(async () => {
            const page = await fetchPage(url, signal);
            return { url, page };
          })
        )
      );
      for (const { url, page } of crawled) {
        if (!page.ok) {
          log.push({ url, ok: false, reason: page.reason });
          continue;
        }
        const extracted = extractReadable(page.html, page.finalUrl);
        if (extracted.noindex) {
          log.push({ url, ok: false, reason: "Page requested noindex" });
          continue;
        }
        sources.push(toSource(page, extracted, { primaryDomain }));
        log.push({ url, ok: true });
      }
    }
  }

  return { sources, log, primaryDomain };
}

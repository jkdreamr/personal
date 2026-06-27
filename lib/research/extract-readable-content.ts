import * as cheerio from "cheerio";

/**
 * Extract readable text from HTML using cheerio. We strip scripts/styles/nav/boilerplate,
 * prefer obvious main-content containers, and return sanitized plain text plus metadata.
 * Scraped HTML is NEVER rendered — only text is kept and later treated as untrusted data.
 */

export type ExtractedContent = {
  title: string;
  text: string;
  excerpt: string;
  publishedAt?: string;
  links: string[]; // same-origin candidate links for discovery
  noindex: boolean;
};

const STRIP = "script,style,noscript,template,svg,iframe,form,nav,header,footer,aside,[role=navigation],[role=banner],[aria-hidden=true],.nav,.menu,.footer,.header,.sidebar,.cookie,.advert,.ad,.newsletter";

function clean(text: string): string {
  return text
    .replace(/ /g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .split("\n")
    .map((l) => l.trim())
    .join("\n")
    .trim();
}

export function extractReadable(html: string, baseUrl: string): ExtractedContent {
  const $ = cheerio.load(html);

  const noindex =
    ($('meta[name="robots"]').attr("content") ?? "").toLowerCase().includes("noindex") ||
    ($('meta[name="googlebot"]').attr("content") ?? "").toLowerCase().includes("noindex");

  const title =
    ($('meta[property="og:title"]').attr("content") || $("title").first().text() || $("h1").first().text() || "Untitled").trim();

  const publishedAt =
    $('meta[property="article:published_time"]').attr("content") ||
    $('meta[name="date"]').attr("content") ||
    $("time[datetime]").first().attr("datetime") ||
    undefined;

  // Collect same-origin links before stripping nav (links often live in nav/footer).
  const links = new Set<string>();
  let baseOrigin = "";
  try {
    baseOrigin = new URL(baseUrl).origin;
  } catch {
    /* ignore */
  }
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    try {
      const u = new URL(href, baseUrl);
      if (u.origin === baseOrigin && (u.protocol === "http:" || u.protocol === "https:")) {
        u.hash = "";
        links.add(u.toString());
      }
    } catch {
      /* ignore malformed */
    }
  });

  $(STRIP).remove();

  // Prefer a main content container; fall back to body.
  const candidates = ["main", "article", '[role="main"]', "#content", ".content", ".post", ".entry-content"];
  let container: cheerio.Cheerio<never> = $("body") as unknown as cheerio.Cheerio<never>;
  let bestLen = container.text().trim().length;
  for (const sel of candidates) {
    const el = $(sel).first();
    if (el.length) {
      const len = el.text().trim().length;
      if (len > 200 && len <= bestLen) {
        container = el as unknown as cheerio.Cheerio<never>;
        bestLen = len;
      }
    }
  }

  // Build text from block-level elements to keep paragraph structure.
  const parts: string[] = [];
  container.find("h1,h2,h3,h4,p,li,blockquote,td,dd,dt").each((_, el) => {
    const t = $(el).text().trim();
    if (t) parts.push(t);
  });
  let text = clean(parts.join("\n"));
  if (text.length < 120) {
    text = clean(container.text());
  }

  const excerpt = clean(text).slice(0, 320);

  return { title, text, excerpt, publishedAt, links: Array.from(links), noindex };
}

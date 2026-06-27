import { describe, it, expect, vi } from "vitest";
import { parseResults } from "@/lib/research/search-duckduckgo";
import { parseSearxngHtml } from "@/lib/research/search-searxng";

describe("SearXNG HTML parsing", () => {
  const html = `
    <article class="result result-default">
      <h3><a href="https://gocard.com/sports/rowing/roster" class="url_header">Rowing Roster</a></h3>
      <p class="content">The 2026 roster lists ...</p>
    </article>
    <article class="result">
      <a href="https://en.wikipedia.org/wiki/Rowing" class="url_header">Rowing</a>
      <p class="content">Rowing is ...</p>
    </article>
    <article class="result">
      <a href="http://127.0.0.1/internal" class="url_header">localhost</a>
    </article>`;
  it("extracts result links + snippets and drops unsafe hosts", () => {
    const hits = parseSearxngHtml(html, 6);
    expect(hits.length).toBe(2);
    expect(hits[0].url).toBe("https://gocard.com/sports/rowing/roster");
    expect(hits[0].title).toContain("Rowing");
    expect(hits[0].snippet).toContain("2026 roster");
    expect(hits.some((h) => h.url.includes("127.0.0.1"))).toBe(false);
  });
  it("respects the limit", () => {
    expect(parseSearxngHtml(html, 1).length).toBe(1);
  });
});

describe("SearXNG JSON path (mocked fetch + real adapter)", () => {
  it("queries the configured instance and parses JSON results, dropping unsafe hosts", async () => {
    const prevUrl = process.env.SEARXNG_URL;
    const prevFetch = global.fetch;
    process.env.SEARXNG_URL = "https://searx.mine.example";
    vi.resetModules();
    const { searxngAdapter } = await import("@/lib/research/search-searxng");

    let calledUrl = "";
    global.fetch = vi.fn(async (url: string) => {
      calledUrl = String(url);
      return {
        ok: true,
        headers: { get: () => "application/json" },
        json: async () => ({
          results: [
            { url: "https://gocard.com/rowing/roster", title: "Roster", content: "2026 lightweight roster" },
            { url: "http://10.0.0.5/internal", title: "private" },
          ],
        }),
      };
    }) as unknown as typeof fetch;

    try {
      const hits = await searxngAdapter.search("joshua koo stanford rowing");
      expect(calledUrl).toContain("https://searx.mine.example/search");
      expect(calledUrl).toContain("format=json");
      expect(hits.length).toBe(1); // private IP dropped
      expect(hits[0].url).toBe("https://gocard.com/rowing/roster");
      expect(hits[0].snippet).toContain("2026");
    } finally {
      global.fetch = prevFetch;
      if (prevUrl === undefined) delete process.env.SEARXNG_URL;
      else process.env.SEARXNG_URL = prevUrl;
      vi.resetModules();
    }
  });
});

describe("DuckDuckGo result parsing", () => {
  const html = `
    <div class="result__body">
      <a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fgocard.com%2Frowing%2Froster&rut=x">Stanford Rowing Roster</a>
      <a class="result__snippet">The official 2026 roster includes ...</a>
    </div>
    <div class="result__body">
      <a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fen.wikipedia.org%2Fwiki%2FStanford">Stanford</a>
      <a class="result__snippet">Stanford University ...</a>
    </div>
    <div class="result__body">
      <a class="result__a" href="//duckduckgo.com/l/?uddg=http%3A%2F%2F127.0.0.1%2Fadmin">localhost</a>
    </div>`;

  it("decodes uddg redirect URLs, keeps order, and drops unsafe hosts", () => {
    const hits = parseResults(html, 6);
    expect(hits.length).toBe(2); // localhost result is dropped by SSRF shape check
    expect(hits[0].url).toBe("https://gocard.com/rowing/roster");
    expect(hits[0].title).toContain("Stanford Rowing");
    expect(hits[1].url).toContain("wikipedia.org");
    expect(hits.every((h) => h.url.startsWith("https://"))).toBe(true);
  });

  it("respects the limit and dedupes", () => {
    const dupe = html + html;
    expect(parseResults(dupe, 1).length).toBe(1);
    expect(parseResults(dupe, 6).length).toBe(2); // duplicates collapsed
  });

  it("returns nothing for empty/garbage html", () => {
    expect(parseResults("<html><body>no results</body></html>", 6)).toEqual([]);
  });
});

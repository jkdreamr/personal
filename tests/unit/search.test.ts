import { describe, it, expect } from "vitest";
import { parseResults } from "@/lib/research/search-duckduckgo";

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

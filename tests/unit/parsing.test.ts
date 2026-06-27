import { describe, it, expect } from "vitest";
import { extractJsonObject, parseLooseJson, safeParseModelJson } from "@/lib/ai/fallback";
import { extractReadable } from "@/lib/research/extract-readable-content";

describe("model JSON extraction", () => {
  it("pulls a JSON object out of prose + code fences", () => {
    const text = 'Sure! Here is the result:\n```json\n{"title":"Hi","sections":[]}\n```\nHope that helps.';
    const obj = extractJsonObject(text);
    expect(obj).toBeTruthy();
    expect(JSON.parse(obj!).title).toBe("Hi");
  });
  it("handles trailing commas", () => {
    expect(parseLooseJson('{"a":1,"b":[1,2,],}')).toEqual({ a: 1, b: [1, 2] });
  });
  it("returns null on hopeless input", () => {
    expect(safeParseModelJson("no json here at all")).toBeNull();
  });
  it("ignores braces inside strings", () => {
    const obj = safeParseModelJson('{"text":"a } b { c","n":1}') as { text: string; n: number };
    expect(obj.text).toBe("a } b { c");
    expect(obj.n).toBe(1);
  });
});

describe("readable content extraction (sanitized text, links, noindex)", () => {
  const html = `<!doctype html><html><head><title>Acme — About</title>
    <meta name="robots" content="index,follow">
    <meta property="article:published_time" content="2025-01-02"></head>
    <body>
      <nav><a href="/about">About</a><a href="https://twitter.com/acme">Twitter</a></nav>
      <main><h1>About Acme</h1><p>Acme builds widgets for teams.</p>
      <script>alert('x')</script><p>Founded in 2019.</p></main>
      <footer><a href="/legal">Legal</a></footer>
    </body></html>`;
  it("extracts title, text, and same-origin links; drops scripts", () => {
    const r = extractReadable(html, "https://acme.com/");
    expect(r.title).toContain("Acme");
    expect(r.text).toContain("Acme builds widgets");
    expect(r.text).not.toContain("alert");
    expect(r.links.some((l) => l.includes("acme.com/about"))).toBe(true);
    expect(r.links.some((l) => l.includes("twitter.com"))).toBe(false);
    expect(r.publishedAt).toBe("2025-01-02");
    expect(r.noindex).toBe(false);
  });
  it("detects noindex", () => {
    const r = extractReadable('<html><head><meta name="robots" content="noindex"><title>x</title></head><body><p>hello world here is text</p></body></html>', "https://x.com/");
    expect(r.noindex).toBe(true);
  });
});

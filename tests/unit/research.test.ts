import { describe, it, expect } from "vitest";
import { parseRobots, isAllowedByRobots } from "@/lib/research/robots";
import { classifyTrust } from "@/lib/research/trust-tier";
import { rankDiscoveredLinks } from "@/lib/research/source-discovery";

describe("robots.txt parsing + matching", () => {
  const txt = `
User-agent: *
Disallow: /private
Disallow: /admin
Allow: /private/public

User-agent: HarborBot
Disallow: /no-harbor
`;
  it("selects the most specific agent group", () => {
    const rules = parseRobots(txt, "HarborBot");
    expect(rules.disallow).toContain("/no-harbor");
    expect(rules.disallow).not.toContain("/admin");
  });
  it("falls back to * group", () => {
    const rules = parseRobots(txt, "SomeOtherBot");
    expect(rules.disallow).toContain("/private");
  });
  it("respects disallow and longest-match allow", () => {
    const rules = parseRobots(txt, "SomeOtherBot");
    expect(isAllowedByRobots(rules, "/admin/users")).toBe(false);
    expect(isAllowedByRobots(rules, "/private/secret")).toBe(false);
    expect(isAllowedByRobots(rules, "/private/public/page")).toBe(true);
    expect(isAllowedByRobots(rules, "/about")).toBe(true);
  });
  it("empty robots allows everything", () => {
    expect(isAllowedByRobots({ disallow: [], allow: [] }, "/anything")).toBe(true);
  });
});

describe("trust tier classification", () => {
  it("marks the subject's own domain as primary", () => {
    expect(classifyTrust("https://acme.com/about", { primaryDomain: "acme.com" })).toBe("primary");
    expect(classifyTrust("https://blog.acme.com/post", { primaryDomain: "acme.com" })).toBe("primary");
  });
  it("classifies reputable, trade, community", () => {
    expect(classifyTrust("https://www.reuters.com/x")).toBe("reputable_reporting");
    expect(classifyTrust("https://sec.gov/filing")).toBe("reputable_reporting");
    expect(classifyTrust("https://techcrunch.com/x")).toBe("trade_press");
    expect(classifyTrust("https://medium.com/@a/x")).toBe("community");
  });
  it("defaults unknown urls to community and missing to user_provided", () => {
    expect(classifyTrust("https://random-unknown-site.xyz/x")).toBe("community");
    expect(classifyTrust(undefined)).toBe("user_provided");
  });
});

describe("source discovery ranking", () => {
  it("prioritises about/product/pricing and caps the count", () => {
    const seed = "https://acme.com";
    const links = [
      "https://acme.com/about",
      "https://acme.com/pricing",
      "https://acme.com/blog/post-1",
      "https://acme.com/legal/terms",
      "https://acme.com/assets/logo.png",
      "https://other.com/about",
    ];
    const ranked = rankDiscoveredLinks(seed, links, 3);
    expect(ranked.length).toBe(3);
    expect(ranked).toContain("https://acme.com/about");
    expect(ranked).toContain("https://acme.com/pricing");
    expect(ranked).not.toContain("https://other.com/about"); // cross-origin excluded
    expect(ranked.every((u) => !u.endsWith(".png"))).toBe(true);
  });
});

/**
 * Minimal robots.txt fetch + matching. We respect Disallow rules for our user agent.
 * Conservative: on any fetch error we DEFAULT TO DISALLOW for crawling beyond the exact
 * URL the user supplied (user-supplied URLs are always allowed — the user asked for them).
 */

const UA = "HarborBot";

export type RobotsRules = {
  disallow: string[];
  allow: string[];
  crawlDelay?: number;
};

const cache = new Map<string, { rules: RobotsRules; expires: number }>();
const TTL = 15 * 60 * 1000;

export function parseRobots(text: string, ua = UA): RobotsRules {
  const lines = text.split(/\r?\n/);
  const groups: { agents: string[]; disallow: string[]; allow: string[]; crawlDelay?: number }[] = [];
  let current: (typeof groups)[number] | null = null;
  let lastWasAgent = false;

  for (const raw of lines) {
    const line = raw.replace(/#.*$/, "").trim();
    if (!line) continue;
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const field = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();

    if (field === "user-agent") {
      if (!lastWasAgent || !current) {
        current = { agents: [], disallow: [], allow: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
    } else if (current) {
      lastWasAgent = false;
      if (field === "disallow") current.disallow.push(value);
      else if (field === "allow") current.allow.push(value);
      else if (field === "crawl-delay") current.crawlDelay = Number(value) || undefined;
    }
  }

  const uaLower = ua.toLowerCase();
  const match =
    groups.find((g) => g.agents.some((a) => a !== "*" && uaLower.includes(a))) ??
    groups.find((g) => g.agents.includes("*"));

  if (!match) return { disallow: [], allow: [] };
  return { disallow: match.disallow.filter(Boolean), allow: match.allow, crawlDelay: match.crawlDelay };
}

export function isAllowedByRobots(rules: RobotsRules, pathname: string): boolean {
  // Longest-match wins between allow and disallow (simplified Google semantics).
  const matchLen = (patterns: string[]) =>
    patterns.reduce((best, p) => {
      if (p === "") return best;
      const prefix = p.endsWith("$") ? p.slice(0, -1) : p;
      if (pathname.startsWith(prefix)) return Math.max(best, prefix.length);
      return best;
    }, -1);

  const dis = matchLen(rules.disallow);
  const allow = matchLen(rules.allow);
  if (dis === -1) return true;
  return allow >= dis;
}

export async function getRobots(origin: string, signal?: AbortSignal): Promise<RobotsRules> {
  const cached = cache.get(origin);
  if (cached && Date.now() < cached.expires) return cached.rules;
  let rules: RobotsRules = { disallow: [], allow: [] };
  try {
    const res = await fetch(`${origin}/robots.txt`, {
      headers: { "User-Agent": UA },
      signal,
    });
    if (res.ok) {
      const text = await res.text();
      rules = parseRobots(text);
    }
  } catch {
    // No robots.txt or unreachable → treat as allow-all for the public site.
    rules = { disallow: [], allow: [] };
  }
  cache.set(origin, { rules, expires: Date.now() + TTL });
  return rules;
}

export { UA as ROBOTS_UA };

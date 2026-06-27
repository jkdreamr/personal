import type { SuggestResponse, Suggestion } from "./suggest-schema";

/**
 * Deterministic, local editorial suggestions for demo mode (no model/network). Each targets an exact
 * substring of the draft so the accept/dismiss flow is fully testable without keys.
 */
const SWAPS: { bad: RegExp; good: string; category: Suggestion["category"]; why: string }[] = [
  { bad: /\butilize\b/i, good: "use", category: "concision", why: 'Simpler than "utilize".' },
  { bad: /\bleverage\b/i, good: "use", category: "concision", why: '"Leverage" is jargon — say "use".' },
  { bad: /\bin order to\b/i, good: "to", category: "concision", why: '"To" is shorter.' },
  { bad: /\ba number of\b/i, good: "several", category: "concision", why: "Be specific or concise." },
  { bad: /\brobust\b/i, good: "strong", category: "clarity", why: '"Robust" is vague.' },
  { bad: /\bholistic\b/i, good: "complete", category: "clarity", why: '"Holistic" is filler.' },
  { bad: /\bgame-changing\b/i, good: "important", category: "tone", why: "Avoid hype." },
  { bad: /\bsynergy\b/i, good: "teamwork", category: "tone", why: "Avoid corporate jargon." },
  { bad: /\bvery unique\b/i, good: "unique", category: "grammar", why: '"Unique" is already absolute.' },
];

const OPENERS = /\b(In conclusion|It is important to note that|At the end of the day|Needless to say)\b/i;

export function demoSuggest(text: string, goal?: string): SuggestResponse {
  const suggestions: Suggestion[] = [];
  for (const s of SWAPS) {
    if (suggestions.length >= 6) break;
    const m = text.match(s.bad);
    if (m) suggestions.push({ target: m[0], replacement: s.good, category: s.category, rationale: s.why });
  }
  if (suggestions.length < 6) {
    const o = text.match(OPENERS);
    if (o) suggestions.push({ target: o[0], replacement: "", category: "concision", rationale: "Cut the throat-clearing opener." });
  }

  const overall: string[] = [];
  overall.push("Lead with your main point so a busy reader gets it in the first line.");
  if (goal?.trim()) overall.push("Make sure every paragraph serves the goal you set; cut anything that doesn’t.");
  overall.push("Prefer concrete specifics — names, numbers, dates — over general statements.");

  return { suggestions, overall: overall.slice(0, 4) };
}

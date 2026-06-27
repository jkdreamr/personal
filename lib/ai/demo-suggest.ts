import type { SuggestResponse, Suggestion } from "./suggest-schema";

/**
 * Deterministic, local editorial suggestions for demo mode (no model/network). Each targets an exact
 * substring of the draft so the accept/dismiss flow is fully testable without keys. The set is broad
 * on purpose — word choice, wordiness, jargon, hype, filler, grammar — so the demo shows the same
 * variety the live model gives.
 */
const SWAPS: { bad: RegExp; good: string; category: Suggestion["category"]; why: string }[] = [
  { bad: /\butilize\b/i, good: "use", category: "concision", why: 'Simpler than "utilize".' },
  { bad: /\bleverage\b/i, good: "use", category: "word-choice", why: '"Leverage" is jargon — say "use".' },
  { bad: /\bin order to\b/i, good: "to", category: "concision", why: '"To" says the same thing.' },
  { bad: /\bdue to the fact that\b/i, good: "because", category: "concision", why: 'Wordy — "because" is enough.' },
  { bad: /\bat this point in time\b/i, good: "now", category: "concision", why: 'Just "now".' },
  { bad: /\bin the event that\b/i, good: "if", category: "concision", why: '"If" is enough.' },
  { bad: /\ba large number of\b/i, good: "many", category: "concision", why: "Tighter and clearer." },
  { bad: /\ba number of\b/i, good: "several", category: "specificity", why: "Be specific, or at least concise." },
  { bad: /\bis able to\b/i, good: "can", category: "concision", why: '"Can" is shorter.' },
  { bad: /\bvery unique\b/i, good: "unique", category: "grammar", why: '"Unique" is already absolute.' },
  { bad: /\bvery important\b/i, good: "essential", category: "word-choice", why: 'One strong word beats "very + adjective".' },
  { bad: /\brobust\b/i, good: "strong", category: "word-choice", why: '"Robust" is vague.' },
  { bad: /\bholistic\b/i, good: "complete", category: "word-choice", why: '"Holistic" is filler.' },
  { bad: /\bgame-changing\b/i, good: "important", category: "tone", why: "Avoid hype." },
  { bad: /\bsynergy\b/i, good: "teamwork", category: "tone", why: "Avoid corporate jargon." },
  { bad: /\bbasically\b/i, good: "", category: "concision", why: '"Basically" adds nothing.' },
  { bad: /\bactually\b/i, good: "", category: "concision", why: 'Cut "actually" — it rarely earns its place.' },
  { bad: /\breally\b/i, good: "", category: "word-choice", why: 'Weak intensifier — cut it or use a stronger word.' },
  { bad: /\bin today's world\b/i, good: "", category: "structure", why: "Skip the throat-clearing opener." },
];

const OPENERS = /\b(In conclusion|It is important to note that|At the end of the day|Needless to say)\b/i;

// Exact context immediately around a match → anchors the correct occurrence of a repeated word.
function anchors(text: string, at: number, len: number): { before: string; after: string } {
  return { before: text.slice(Math.max(0, at - 16), at), after: text.slice(at + len, at + len + 16) };
}

export function demoSuggest(text: string, goal?: string): SuggestResponse {
  const suggestions: Suggestion[] = [];
  const seen = new Set<string>();
  for (const s of SWAPS) {
    if (suggestions.length >= 12) break;
    const m = text.match(s.bad);
    if (m && m.index != null && !seen.has(m[0].toLowerCase())) {
      seen.add(m[0].toLowerCase());
      suggestions.push({ target: m[0], replacement: s.good, category: s.category, rationale: s.why, ...anchors(text, m.index, m[0].length) });
    }
  }
  if (suggestions.length < 12) {
    const o = text.match(OPENERS);
    if (o && o.index != null)
      suggestions.push({ target: o[0], replacement: "", category: "structure", rationale: "Cut the throat-clearing opener — lead with the point.", ...anchors(text, o.index, o[0].length) });
  }

  const overall: string[] = ["Lead with your main point so a busy reader gets it in the first line."];
  if (goal?.trim()) overall.push("Make sure every paragraph serves the goal you set; cut anything that doesn’t.");
  overall.push(
    "Prefer concrete specifics — names, numbers, dates — over general statements.",
    "Vary sentence length: break up the longest sentences so the rhythm doesn’t flatten.",
    "Read it aloud once and cut any word you stumble over."
  );

  return { suggestions, overall: overall.slice(0, 5) };
}

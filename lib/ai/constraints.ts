/**
 * Length & format constraint detection. When a user states how long the output should be — "300
 * words", "in 3 paragraphs", "two sentences", "5 bullet points", "a one-pager", "under 280
 * characters", "8–10 slides" — Harbor must obey it exactly, not the coarse Short/Balanced/Thorough
 * hint. This parses those constraints out of free text so the prompt can state them forcefully.
 */

export type LengthUnit = "words" | "sentences" | "paragraphs" | "bullets" | "slides" | "characters" | "pages" | "lines";
export type LengthBound = "exact" | "max" | "min" | "around" | "range";
export type LengthConstraint = { unit: LengthUnit; bound: LengthBound; value: number; value2?: number };

const NUMBER_WORDS: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18,
  nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
  hundred: 100, thousand: 1000,
};

function toNumber(token: string): number | null {
  const t = token.toLowerCase().replace(/,/g, "");
  if (/^\d+$/.test(t)) return parseInt(t, 10);
  if (t in NUMBER_WORDS) return NUMBER_WORDS[t];
  return null;
}

// Map a matched unit word to its canonical unit.
const UNIT_MAP: Record<string, LengthUnit> = {
  word: "words", words: "words",
  sentence: "sentences", sentences: "sentences",
  paragraph: "paragraphs", paragraphs: "paragraphs", para: "paragraphs", paras: "paragraphs",
  bullet: "bullets", bullets: "bullets", point: "bullets", points: "bullets",
  slide: "slides", slides: "slides",
  character: "characters", characters: "characters", char: "characters", chars: "characters",
  page: "pages", pages: "pages", pager: "pages",
  line: "lines", lines: "lines",
};
const UNIT_PATTERN = "words?|sentences?|paragraphs?|paras?|bullets?|points?|slides?|characters?|chars?|pages?|pager|lines?";
const NUM = "\\d+(?:,\\d{3})*|a|an|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand";

const MAX_WORDS = /\b(under|below|at most|no more than|fewer than|less than|up to|maximum|max|within)\b/;
const MIN_WORDS = /\b(at least|more than|minimum|min|over|no fewer than)\b/;
const AROUND_WORDS = /\b(around|about|approximately|roughly|circa|~|ish)\b/;

function boundFromPrefix(prefix: string): LengthBound {
  if (AROUND_WORDS.test(prefix) || /~\s*$/.test(prefix)) return "around";
  if (MAX_WORDS.test(prefix)) return "max";
  if (MIN_WORDS.test(prefix)) return "min";
  return "exact";
}

/** Parse every length/format constraint found in free text. Deduplicated by unit (first wins). */
export function parseLengthConstraints(text: string): LengthConstraint[] {
  if (!text) return [];
  const out: LengthConstraint[] = [];
  const seen = new Set<LengthUnit>();
  const add = (c: LengthConstraint) => {
    if (!seen.has(c.unit) && c.value > 0) {
      seen.add(c.unit);
      out.push(c);
    }
  };

  // 1) Ranges: "200-300 words", "8 to 10 slides", "between 2 and 3 paragraphs".
  const range = new RegExp(`(?:between\\s+)?(${NUM})\\s*(?:-|–|—|to|and)\\s*(${NUM})[\\s-]*(${UNIT_PATTERN})\\b`, "gi");
  for (const m of text.matchAll(range)) {
    const a = toNumber(m[1]);
    const b = toNumber(m[2]);
    const unit = UNIT_MAP[m[3].toLowerCase()];
    if (a != null && b != null && unit) add({ unit, bound: "range", value: Math.min(a, b), value2: Math.max(a, b) });
  }

  // 2) "one-pager" / "two pager" → pages.
  for (const m of text.matchAll(/\b(a|one|two|three|\d+)[\s-]*pager\b/gi)) {
    const n = toNumber(m[1]);
    if (n != null) add({ unit: "pages", bound: "exact", value: n });
  }

  // 3) Single value with an optional bound prefix: "under 100 words", "exactly 3 paragraphs".
  const single = new RegExp(`(${NUM})[\\s-]*(${UNIT_PATTERN})\\b`, "gi");
  for (const m of text.matchAll(single)) {
    const value = toNumber(m[1]);
    const unit = UNIT_MAP[m[2].toLowerCase()];
    if (value == null || !unit) continue;
    const prefix = text.slice(Math.max(0, m.index! - 24), m.index!);
    add({ unit, bound: boundFromPrefix(prefix), value });
  }

  return out;
}

function phrase(c: LengthConstraint): string {
  const u = c.unit;
  switch (c.bound) {
    case "max":
      return `at most ${c.value} ${u}`;
    case "min":
      return `at least ${c.value} ${u}`;
    case "around":
      return `about ${c.value} ${u}`;
    case "range":
      return `between ${c.value} and ${c.value2} ${u}`;
    default:
      return `exactly ${c.value} ${u}`;
  }
}

/**
 * A forceful, unambiguous instruction stating the detected length requirements — meant to OVERRIDE
 * the coarse length hint. Returns "" when no explicit constraint is present (so the normal length
 * guidance applies).
 */
export function lengthInstruction(...texts: (string | undefined)[]): string {
  const constraints = parseLengthConstraints(texts.filter(Boolean).join("\n"));
  if (!constraints.length) return "";
  const units = Array.from(new Set(constraints.map((c) => c.unit))).join(" and ");
  return (
    `LENGTH REQUIREMENT — this is a hard constraint from the user and OVERRIDES any other length guidance. ` +
    `The output must be ${constraints.map(phrase).join("; ")}. ` +
    `Plan the structure to fit, then count the ${units} and revise until it fits precisely before you finish.`
  );
}

/** True when the text contains any explicit length/format constraint. */
export function hasLengthConstraint(...texts: (string | undefined)[]): boolean {
  return parseLengthConstraints(texts.filter(Boolean).join("\n")).length > 0;
}

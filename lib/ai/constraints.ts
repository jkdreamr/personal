/**
 * Output-requirement detection. When a user states how the result should be shaped — length ("300
 * words", "3 paragraphs", "two sentences", "5 bullets", "8–10 slides", "under 280 characters", "a
 * one-pager"), structure ("as a table", "in prose", "no headings", "TL;DR"), language ("in Spanish",
 * "translate to French"), reading level ("plain English", "ELI5"), or point of view — Harbor must
 * obey it exactly, not its own defaults. This parses those out of the user's request (and short
 * pasted context) so the prompt can state them forcefully and they override conflicting defaults.
 * `outputRequirements()` is the single entry point the prompts use.
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

/** True when the text contains any explicit length/format constraint. */
export function hasLengthConstraint(...texts: (string | undefined)[]): boolean {
  return parseLengthConstraints(texts.filter(Boolean).join("\n")).length > 0;
}

// ---------------------------------------------------------------------------
// Beyond length: structure, language, reading level, and point of view. These
// are things models commonly default-override (their own headings/bullets, English,
// jargon), so when a user states one we surface it as a hard, overriding instruction.
// Regexes are written to require an explicit cue ("in prose", "as a table", "in Spanish")
// so incidental phrasing ("the conference table", "the Spanish market") does not trigger.
// ---------------------------------------------------------------------------

export type FormatDirective = "bullets" | "numbered" | "table" | "prose" | "no-headings" | "tldr" | "qa" | "checklist" | "no-emojis";

const FORMAT_INSTRUCTION: Record<FormatDirective, string> = {
  prose: "Write in flowing prose paragraphs — do NOT use bullet points or lists.",
  bullets: "Format the main content as a bulleted list.",
  numbered: "Format the main content as a numbered, step-by-step list.",
  table: "Present the information as a table.",
  "no-headings": "Do not use section headings.",
  tldr: "Open with a one-line bottom-line summary before any detail.",
  qa: "Use a question-and-answer format.",
  checklist: "Format as an actionable checklist.",
  "no-emojis": "Do not use any emojis.",
};

export function parseFormatDirectives(text: string): FormatDirective[] {
  const t = (text || "").toLowerCase();
  const found = new Set<FormatDirective>();
  // "prose" / "no bullets" wins over "bullets" if both somehow appear.
  if (/\b(in|as)\s+prose\b|\bprose only\b|\bparagraphs?\s+only\b|\b(no|without|don'?t use|do not use|avoid)\s+(bullets?|bullet points?|lists?)\b/.test(t)) found.add("prose");
  if (!found.has("prose") && /\bbullet points?\b|\bbulleted list\b|\bas bullets\b|\bin bullets\b|\bbullet form\b/.test(t)) found.add("bullets");
  if (/\bnumbered (list|steps)\b|\bas steps\b|\bstep[\s-]by[\s-]step\b/.test(t)) found.add("numbered");
  if (/\b(as a|in a|as|in)\s+table\b|\btable\s+(format|form)\b|\bcomparison table\b/.test(t)) found.add("table");
  if (/\b(no|without|don'?t use|do not use)\s+headings?\b/.test(t)) found.add("no-headings");
  if (/\btl;?dr\b|\bbluf\b|\bbottom[\s-]line[\s-]up[\s-]front\b|\bsummary (at|on)(\s+the)?\s+top\b|\blead with (the )?(conclusion|bottom line|recommendation)\b/.test(t)) found.add("tldr");
  if (/\bq\s*&\s*a\b|\bquestions? and answers?\b/.test(t)) found.add("qa");
  if (/\bchecklist\b/.test(t)) found.add("checklist");
  if (/\b(no|without|don'?t use|do not use)\s+emojis?\b/.test(t)) found.add("no-emojis");
  return [...found];
}

const LANGUAGES = [
  "English", "Spanish", "French", "German", "Italian", "Portuguese", "Dutch", "Russian", "Mandarin", "Chinese",
  "Cantonese", "Japanese", "Korean", "Arabic", "Hindi", "Bengali", "Punjabi", "Tamil", "Telugu", "Hebrew",
  "Turkish", "Polish", "Swedish", "Norwegian", "Danish", "Finnish", "Greek", "Czech", "Romanian", "Hungarian",
  "Thai", "Vietnamese", "Indonesian", "Malay", "Tagalog", "Filipino", "Ukrainian", "Urdu", "Persian", "Farsi",
  "Swahili", "Catalan",
];

/** Detect a requested OUTPUT language. Requires a writing cue or a clause-final "in <Language>". */
export function parseLanguage(text: string): string | null {
  for (const lang of LANGUAGES) {
    const patterns = [
      new RegExp(`\\b(?:write|written|respond|reply|translate|draft|answer|compose|summari[sz]e|explain|describe|render|output|put it|provide it)\\b[^.?!\\n]*?\\bin\\s+${lang}\\b`, "i"),
      new RegExp(`\\btranslate(?:d)?\\b[^.?!\\n]*?\\b(?:in)?to\\s+${lang}\\b`, "i"),
      new RegExp(`\\bin\\s+${lang}\\b\\s*(?:[.,;!?)]|$|only|please|throughout)`, "i"),
      new RegExp(`\\b${lang}\\s+(?:version|translation)\\b`, "i"),
    ];
    if (patterns.some((re) => re.test(text))) {
      return lang === "Farsi" ? "Persian" : lang === "Filipino" ? "Tagalog" : lang;
    }
  }
  return null;
}

/** Detect a request for plain / simple language (reading level). */
export function parseReadingLevel(text: string): string | null {
  const re =
    /\bplain english\b|\bsimple (?:language|terms|words|english)\b|\blay(?:man|men|person)'?s?\s+terms\b|\beli5\b|\bexplain like i'?m (?:5|five)\b|\bfor a \d+[\s-]year[\s-]old\b|\bfor a \d+(?:st|nd|rd|th)[\s-]grader?\b|\bnon[\s-]technical\b|\bjargon[\s-]free\b|\bno jargon\b|\beasy to (?:understand|read|follow)\b/i;
  return re.test(text || "") ? "Use plain, simple language a non-expert can follow; avoid jargon and define any necessary terms." : null;
}

/** Detect first/second/third-person point of view. Requires an "in … person" cue or the hyphenated
 *  form ("third-person"), so an incidental "the third person to arrive" doesn't trigger. */
export function parsePerson(text: string): string | null {
  const m = (text || "").match(/\bin (?:the )?(first|second|third)\s+person\b|\b(first|second|third)-person\b/i);
  if (!m) return null;
  const p = (m[1] || m[2]).toLowerCase();
  return `Write in the ${p} person.`;
}

/**
 * The unified, forceful "output requirements" block built from everything the user explicitly asked
 * for — length, structure, language, reading level, point of view. Returns "" when nothing explicit
 * is present (so normal defaults apply). This is what the prompts inject.
 */
export function outputRequirements(...texts: (string | undefined)[]): string {
  const text = texts.filter(Boolean).join("\n");
  if (!text.trim()) return "";
  const reqs: string[] = [];

  const len = parseLengthConstraints(text);
  if (len.length) reqs.push(`Length — it must be ${len.map(phrase).join("; ")}. Count and revise until it fits exactly before finishing.`);
  for (const f of parseFormatDirectives(text)) reqs.push(FORMAT_INSTRUCTION[f]);
  const lang = parseLanguage(text);
  if (lang) reqs.push(`Write the ENTIRE output (including any headings) in ${lang}.`);
  const rl = parseReadingLevel(text);
  if (rl) reqs.push(rl);
  const pov = parsePerson(text);
  if (pov) reqs.push(pov);

  if (!reqs.length) return "";
  return `OUTPUT REQUIREMENTS — explicit user instructions that OVERRIDE any default style, length, or structure. Obey every one exactly:\n- ${reqs.join("\n- ")}`;
}

/** True when the text contains ANY explicit output requirement (length, format, language, …). */
export function hasOutputRequirements(...texts: (string | undefined)[]): boolean {
  return outputRequirements(...texts).length > 0;
}

/**
 * Returns the text only when it is short enough to be a typed instruction rather than a source
 * document. Use this to scan pasted CONTEXT for requirements ("make this 300 words") without
 * mis-reading numbers inside a long article/PDF the user pasted as material.
 */
export function shortContext(text?: string, max = 600): string | undefined {
  const t = text?.trim();
  return t && t.length > 0 && t.length <= max ? t : undefined;
}

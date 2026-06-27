import type { ServiceId } from "./services";
import type { AttachmentKind } from "./types";

/**
 * Infer the likely service from a plain sentence + the kinds of context attached.
 * Returns a ranked guess and a confidence. High confidence → proceed automatically.
 * Low confidence → the UI shows one light confirmation with two or three options.
 */

export type IntentSignal = {
  text: string;
  attachmentKinds: AttachmentKind[];
  hasImage?: boolean;
  hasEmail?: boolean;
  /** number of distinct documents/links — 2+ hints at comparison. */
  itemCount?: number;
};

export type IntentGuess = {
  service: ServiceId;
  confidence: number; // 0..1
  reason: string;
  alternatives: ServiceId[];
};

type Rule = { service: ServiceId; re: RegExp; weight: number };

const RULES: Rule[] = [
  { service: "write", re: /\b(write|draft|reply|respond|email|note|letter|message|follow[- ]?up|memo|update)\b/i, weight: 3 },
  { service: "notes", re: /\b(organi[sz]e|clean up|tidy|notes|whiteboard|brainstorm|jot|messy|checklist|to-?do)\b/i, weight: 3 },
  { service: "present", re: /\b(present|presentation|slides?|deck|pitch|keynote|storyline)\b/i, weight: 4 },
  // Require intent to propose — a passing mention of "this proposal" shouldn't win
  // over, say, "what could go wrong with this proposal" (which is Challenge).
  { service: "proposal", re: /\b(propose|statement of work|scope of work|\b(?:write|draft|build|create|put together)\b[^.]*\bproposal)\b/i, weight: 4 },
  { service: "research", re: /\b(research|look into|find out about|background on|understand|learn about|brief me on|company)\b/i, weight: 3 },
  { service: "challenge", re: /\b(risk|risks|wrong|pressure[- ]?test|challenge|counter|red[- ]?team|poke holes|due diligence|what could go wrong)\b/i, weight: 4 },
  { service: "verify", re: /\b(verify|fact[- ]?check|check the claims?|is this true|accurate|supported|sources?)\b/i, weight: 4 },
  { service: "compare", re: /\b(compare|comparison|versus|vs\.?|side by side|which is better|options?)\b/i, weight: 4 },
  { service: "brief", re: /\b(brief|briefing|one[- ]?pager|summary for|read[- ]?in|executive summary)\b/i, weight: 3 },
  { service: "meeting", re: /\b(meeting|call|prepare me|prep|agenda|before my (?:meeting|call)|first call)\b/i, weight: 4 },
  { service: "decide", re: /\b(decide|decision|should (?:i|we)|choose|whether to|pros and cons|tradeoffs?)\b/i, weight: 4 },
  { service: "explain", re: /\b(explain|what does this mean|plain english|understand this (?:document|contract|bill)|contract|terms|legal|bill|notice|insurance)\b/i, weight: 4 },
];

export function inferIntent(signal: IntentSignal): IntentGuess {
  const text = (signal.text ?? "").trim();
  const scores = new Map<ServiceId, number>();
  const add = (s: ServiceId, n: number) => scores.set(s, (scores.get(s) ?? 0) + n);

  for (const rule of RULES) {
    if (rule.re.test(text)) add(rule.service, rule.weight);
  }

  // Context-based nudges.
  if (signal.hasImage) add("notes", 3); // a photo usually means messy notes to organize
  if (signal.hasEmail) {
    add("write", 2);
    add("meeting", 1);
  }
  if ((signal.itemCount ?? 0) >= 2) add("compare", 3);
  if (signal.attachmentKinds.includes("link")) {
    add("research", 1);
    add("meeting", 1);
  }

  // Default lean when nothing matches: writing is the most common starting point.
  if (scores.size === 0) {
    return {
      service: "write",
      confidence: 0.25,
      reason: "No strong signal yet — Harbor will start with a draft you can change.",
      alternatives: ["notes", "research", "explain"],
    };
  }

  const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1]);
  const [topService, topScore] = ranked[0];
  const secondScore = ranked[1]?.[1] ?? 0;
  const total = ranked.reduce((n, [, s]) => n + s, 0);

  // Confidence rewards a clear leader.
  const margin = (topScore - secondScore) / Math.max(1, topScore);
  const share = topScore / Math.max(1, total);
  const confidence = Math.min(0.95, 0.4 + margin * 0.35 + share * 0.3);

  return {
    service: topService,
    confidence,
    reason: reasonFor(topService),
    alternatives: ranked.slice(1, 3).map(([s]) => s),
  };
}

function reasonFor(service: ServiceId): string {
  const map: Record<ServiceId, string> = {
    write: "This looks like something to write.",
    notes: "This looks like notes to organize.",
    present: "This looks like a presentation.",
    proposal: "This looks like a proposal.",
    research: "This looks like research.",
    challenge: "This looks like a request to find risks.",
    verify: "This looks like fact-checking.",
    compare: "This looks like a comparison.",
    brief: "This looks like a briefing.",
    meeting: "This looks like meeting preparation.",
    decide: "This looks like a decision.",
    explain: "This looks like a document to explain.",
  };
  return map[service];
}

/** A high-confidence guess can proceed without asking. */
export function shouldAutoProceed(guess: IntentGuess): boolean {
  return guess.confidence >= 0.7;
}

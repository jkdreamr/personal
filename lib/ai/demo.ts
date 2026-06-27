import type { ServiceId } from "@/lib/services";
import type { Adjustments, Artifact, Attachment, Claim, Section, Slide, Source } from "@/lib/types";
import { uid } from "@/lib/utils";

/**
 * Demo-mode artifact generator.
 *
 * Runs with no model key. Output is built deterministically from the user's OWN goal and
 * attached text. It NEVER invents external facts, citations, dates, or URLs. Every artifact
 * is flagged `demo: true` and the UI labels it clearly. This exists so the whole product is
 * usable and end-to-end testable offline — and so the automated tests are deterministic.
 */

function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"'])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 8);
}

function splitLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.replace(/^[-*•\d.)\s]+/, "").trim())
    .filter((l) => l.length > 1);
}

const ACTION_HINT = /\b(send|email|call|schedule|review|confirm|sign|pay|follow[- ]?up|decide|prepare|draft|book|finish|update|check|ask|share|submit|respond|reply)\b/i;
const DATE_HINT = /\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}-\d{2}-\d{2}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2}(?:,?\s+\d{4})?|(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)|\b(?:today|tomorrow|next week|this week|by end of \w+))\b/gi;
const MONEY_HINT = /(?:[$£€]\s?\d[\d,]*(?:\.\d+)?(?:\s?(?:k|m|bn|million|billion))?|\b\d[\d,]*(?:\.\d+)?\s?(?:USD|EUR|GBP|dollars|euros|pounds)\b)/gi;

function gatherText(attachments: Attachment[]): string {
  return attachments
    .map((a) => a.text)
    .filter(Boolean)
    .join("\n\n")
    .trim();
}

function keyIdeas(text: string, limit = 6): string[] {
  const lines = splitLines(text);
  const source = lines.length >= 3 ? lines : splitSentences(text);
  return source.slice(0, limit);
}

function nextSteps(text: string): string[] {
  const lines = [...splitLines(text), ...splitSentences(text)];
  const found = lines.filter((l) => ACTION_HINT.test(l)).slice(0, 5);
  return found;
}

function uniqueMatches(text: string, re: RegExp): string[] {
  const out = new Set<string>();
  for (const m of text.matchAll(re)) out.add(m[0].trim());
  return Array.from(out).slice(0, 8);
}

function userSource(attachments: Attachment[]): Source[] {
  const withText = attachments.filter((a) => a.text?.trim());
  return withText.map((a) => ({
    id: uid("src"),
    title: a.label,
    trustTier: "user_provided" as const,
    retrievedAt: new Date().toISOString(),
    excerpt: a.text.slice(0, 240).replace(/\s+/g, " ").trim(),
  }));
}

const DEMO_NOTE =
  "Demo example built locally from your input. It does not call a model or fetch the web, so it won't add outside facts. Add an OpenRouter key for full results.";

function emptyMaterialSection(): Section {
  return {
    heading: "Add some material",
    body: "This demo works from the text you provide. Paste or upload something and Harbor will organize it. With a model key connected, Harbor also drafts and researches in full.",
  };
}

export function generateDemoArtifact(opts: {
  service: ServiceId;
  goal: string;
  attachments: Attachment[];
  adjustments: Adjustments;
}): Artifact {
  const { service, goal, attachments } = opts;
  // Prefer attached material; if none, a substantive sentence can itself be the material
  // (common when someone types their notes straight into the box).
  const attachedText = gatherText(attachments);
  const text = attachedText || (goal.trim().length > 40 ? goal.trim() : "");
  const has = text.length > 0;
  const ideas = has ? keyIdeas(text) : [];
  const steps = has ? nextSteps(text) : [];
  const goalLabel = goal.trim() || "your material";
  const sources = userSource(attachments);

  const baseAssumptions = [
    "Harbor treated this as a professional audience.",
    has ? "Built only from the material you provided." : "No material was attached, so this is a template to fill in.",
  ];

  function bullets(items: string[]): string {
    return items.length ? items.map((i) => `- ${i}`).join("\n") : "- (nothing detected in the material yet)";
  }

  let sections: Section[] = [];
  let claims: Claim[] | undefined;
  let slides: Slide[] | undefined;
  let comparison: Artifact["comparison"];
  let email: Artifact["email"];
  let openQuestions: string[] = ["Is there context Harbor should know that wasn't in the material?"];
  let nextActions: string[] = steps.length ? steps : ["Review this draft and add anything missing."];
  let disclaimer: string | undefined;
  let title = `${capitalize(service)} — ${truncateTitle(goalLabel)}`;
  let summary = `A ${service} draft built from your material. Review before you use it.`;

  if (!has && service !== "decide") {
    sections = [emptyMaterialSection()];
  } else {
    switch (service) {
      case "write": {
        const opening = ideas[0] ?? goalLabel;
        sections = [
          {
            heading: "Draft",
            kind: "lead",
            body: `${opening}\n\nThis draft pulls together the points from your material. ${
              ideas[1] ? ideas[1] : ""
            }\n\n${ideas.slice(2).map((i) => i).join(" ")}`.trim(),
          },
          { heading: "Suggested next step", body: bullets(steps.length ? steps : ["Send this once you've reviewed it."]) },
        ];
        email = {
          subjectOptions: [truncateTitle(goalLabel, 48), "Following up", "Quick note"],
          body: `Hi,\n\n${opening}\n\n${ideas.slice(1, 3).join(" ")}\n\nBest,\n`,
        };
        summary = "A ready-to-edit draft based on your notes.";
        break;
      }
      case "notes": {
        sections = [
          { heading: "Summary", kind: "lead", body: ideas[0] ?? "Your notes, organized." },
          { heading: "Key ideas", kind: "list", body: bullets(ideas) },
          { heading: "Decisions", body: bullets(ideas.filter((i) => /decid|agree|chose|will|won't/i.test(i))) },
          { heading: "Next steps", kind: "list", body: bullets(steps) },
          { heading: "Open questions", body: bullets(["Anything in the notes that's still unresolved?"]) },
        ];
        const lowConf = attachments.some((a) => a.meta?.lowConfidence);
        if (lowConf) {
          sections.push({
            heading: "Unclear text to confirm",
            kind: "callout",
            body: "Some text came from a photo and may be misread. Check anything that looks off before relying on it.",
          });
        }
        summary = "Your notes, cleaned up into structure.";
        break;
      }
      case "present": {
        const pts = ideas.length ? ideas : [goalLabel];
        slides = buildDemoSlides(goalLabel, pts);
        sections = [
          { heading: "Thesis", kind: "lead", body: pts[0] ?? goalLabel },
          { heading: "Audience takeaway", body: "What you want them to remember and do after this." },
          { heading: "Narrative arc", kind: "list", body: bullets(pts.slice(0, 6)) },
        ];
        summary = "An 8-slide storyline you can edit and present.";
        break;
      }
      case "proposal": {
        sections = [
          { heading: "Client context", body: ideas[0] ?? "What you know about the client, from your material." },
          { heading: "What the client needs", kind: "list", body: bullets(ideas.slice(0, 3)) },
          { heading: "Recommended scope", kind: "list", body: bullets(steps.length ? steps : ["Define scope from the discovery notes."]) },
          { heading: "Deliverables", body: bullets(["A clear set of deliverables tied to the scope above."]) },
          { heading: "Timeline", body: "A realistic phase plan — fill in dates once scope is agreed." },
          { heading: "Risks and exclusions", body: bullets(["List what is explicitly out of scope to avoid surprises."]) },
        ];
        email = { subjectOptions: ["Proposal for your review", "Next steps"], body: `Hi,\n\nThank you for the conversation. Attached is a proposal based on what we discussed.\n\nBest,\n` };
        break;
      }
      case "research": {
        claims = ideasToClaims(ideas, sources);
        sections = [
          { heading: "Overview", kind: "lead", body: ideas[0] ?? "What this is, from the material you supplied." },
          { heading: "What they do", body: bullets(ideas.slice(0, 4)) },
          { heading: "Open questions", kind: "list", body: bullets(["What public sources would confirm these points?"]) },
        ];
        openQuestions = ["What specific outcome do you need from this research?", "Which public pages should Harbor read?"];
        summary = "A starting brief from your material — connect a key for source-backed research.";
        break;
      }
      case "challenge": {
        claims = ideasToClaims(ideas, sources, true);
        sections = [
          { heading: "What could go wrong", kind: "list", body: bullets(ideas.slice(0, 4).map((i) => `Risk in: ${i}`)) },
          { heading: "Strongest counterarguments", body: bullets(["The opposite case worth taking seriously."]) },
          { heading: "Missing evidence", body: bullets(["What would need to be true — and isn't shown yet."]) },
          { heading: "Recommended diligence steps", kind: "list", body: bullets(["Confirm each claim against an independent source."]) },
        ];
        summary = "A fair pressure-test of your material, with every point labelled.";
        break;
      }
      case "verify": {
        claims = ideasToClaims(ideas, sources);
        sections = [
          {
            heading: "How to read this",
            kind: "callout",
            body: "This review is based on the sources you provided and public pages Harbor could access. In demo mode, only your own text is treated as a source.",
          },
        ];
        summary = "A claim-by-claim review of what's supported.";
        break;
      }
      case "compare": {
        comparison = buildDemoComparison(attachments);
        sections = [
          { heading: "Meaningful differences", body: bullets(["The differences that actually affect your decision."]) },
          { heading: "Missing information", body: bullets(["What you'd need to compare these fairly."]) },
        ];
        openQuestions = ["What matters most here: cost, quality, speed, risk, or something else?"];
        nextActions = ["Tell Harbor what matters most and it will recommend a next step."];
        break;
      }
      case "brief": {
        claims = ideasToClaims(ideas, sources);
        sections = [
          { heading: "Executive summary", kind: "lead", body: ideas[0] ?? goalLabel },
          { heading: "What matters", kind: "list", body: bullets(ideas.slice(0, 4)) },
          { heading: "Risks", body: bullets(["The main risks visible in the material."]) },
          { heading: "Recommended next steps", kind: "list", body: bullets(steps) },
        ];
        summary = ideas[0] ? truncateTitle(ideas[0], 120) : "A one-page brief from your material.";
        break;
      }
      case "meeting": {
        sections = [
          { heading: "Meeting objective", kind: "lead", body: goalLabel },
          { heading: "Relevant background", body: bullets(ideas.slice(0, 4)) },
          { heading: "Talking points", kind: "list", body: bullets(ideas.slice(0, 4)) },
          { heading: "Potential concerns", body: bullets(["Likely objections to prepare for."]) },
        ];
        openQuestions = ["What questions do you most want answered in this meeting?"];
        email = { subjectOptions: ["Great to connect", "Following up on our meeting"], body: `Hi,\n\nThank you for your time today. To recap what we agreed:\n\n${bullets(steps)}\n\nBest,\n` };
        break;
      }
      case "decide": {
        sections = [
          { heading: "Decision statement", kind: "lead", body: goalLabel },
          { heading: "Options", kind: "list", body: bullets(ideas.length ? ideas.slice(0, 4) : ["Option A", "Option B"]) },
          { heading: "Decision criteria", body: bullets(["What you'll judge the options against."]) },
          { heading: "Tradeoffs", body: bullets(["What each option costs you."]) },
          { heading: "Unknowns", kind: "callout", body: "Harbor won't be falsely certain. Name what you don't yet know before deciding." },
        ];
        nextActions = ["Gather the missing information under Unknowns, then revisit."];
        break;
      }
      case "explain": {
        const dates = uniqueMatches(text, DATE_HINT);
        const money = uniqueMatches(text, MONEY_HINT);
        sections = [
          { heading: "Plain-English summary", kind: "lead", body: ideas.slice(0, 3).join(" ") || "What this document says, in plain terms." },
          { heading: "Important dates", kind: "list", body: dates.length ? bullets(dates) : "- No clear dates found in the text." },
          { heading: "Required actions", kind: "list", body: bullets(steps) },
          { heading: "Fees and obligations", body: money.length ? bullets(money) : "No amounts were clearly stated in the text." },
          { heading: "What needs professional review", body: "Anything legally or financially binding is worth confirming with a qualified professional." },
        ];
        disclaimer = "This is a plain-language summary, not legal, medical, tax, or financial advice.";
        break;
      }
    }
  }

  return {
    service,
    title,
    summary,
    sections,
    assumptions: baseAssumptions,
    claims,
    sources: sources.length ? sources : undefined,
    openQuestions,
    nextActions,
    disclaimer,
    coverageNote: DEMO_NOTE,
    email,
    slides,
    comparison,
    demo: true,
  };
}

function ideasToClaims(ideas: string[], sources: Source[], adversarial = false): Claim[] {
  const sid = sources[0]?.id;
  return ideas.slice(0, 5).map((text) => ({
    id: uid("clm"),
    text,
    // In demo mode we never assert verified_fact — we only have the user's own text.
    classification: adversarial ? "unresolved_question" : "reported_claim",
    sourceIds: sid ? [sid] : [],
    supportingExcerpts: sid ? [text.slice(0, 160)] : [],
    confidence: "low",
  }));
}

function buildDemoSlides(goal: string, points: string[]): Slide[] {
  const p = points.length ? points : [goal];
  const slides: Slide[] = [
    { layout: "cover", title: truncateTitle(goal, 60), message: truncateTitle(goal, 60), speakerNotes: "Set the room. State why this matters now." },
    { layout: "thesis", title: "The idea", message: p[0] ?? goal, bullets: p.slice(0, 2), speakerNotes: "One clear sentence they'll remember." },
    { layout: "problem", title: "The tension", message: "What's at stake if nothing changes.", bullets: p.slice(0, 2) },
    { layout: "insight", title: "What we see", message: p[1] ?? "The key insight.", bullets: p.slice(1, 3) },
    { layout: "framework", title: "How it works", message: "The approach, in three parts.", bullets: p.slice(0, 3) },
    { layout: "timeline", title: "The path", message: "What happens, and when.", bullets: ["Now", "Next", "Then"] },
    { layout: "recommendation", title: "The ask", message: "What we recommend.", bullets: p.slice(0, 2) },
    { layout: "closing", title: "Close", message: truncateTitle(goal, 60), speakerNotes: "Restate the ask. Make the next step concrete." },
  ];
  return slides;
}

function buildDemoComparison(attachments: Attachment[]): Artifact["comparison"] {
  const withText = attachments.filter((a) => a.text?.trim());
  const options = withText.length >= 2 ? withText.map((a) => a.label) : ["Option A", "Option B"];
  return {
    options,
    criteria: [
      { label: "What it is", values: options.map((_, i) => (withText[i] ? keyIdeas(withText[i].text, 1)[0] ?? "—" : "—")) },
      { label: "Strengths", values: options.map(() => "Fill in from the material") },
      { label: "Risks", values: options.map(() => "Fill in from the material") },
      { label: "Missing info", values: options.map(() => "What you'd need to decide") },
    ],
    notes: "Tell Harbor what matters most and it will weigh these for you.",
  };
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function truncateTitle(s: string, max = 64): string {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > max ? t.slice(0, max - 1).trimEnd() + "…" : t;
}

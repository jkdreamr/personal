/**
 * The service registry. Every tab is a configuration over the shared task engine.
 * Keep this declarative: prompts, schemas, and UI all read from here.
 */

export type ServiceId =
  | "write"
  | "notes"
  | "present"
  | "proposal"
  | "research"
  | "challenge"
  | "verify"
  | "compare"
  | "brief"
  | "meeting"
  | "decide"
  | "explain";

export type ServiceGroup = "create" | "intelligence" | "action";

export type ModelPreference = "primary" | "fast" | "reviewer";

export type ServiceConfig = {
  id: ServiceId;
  group: ServiceGroup;
  label: string;
  /** Lucide icon name, resolved in the UI layer. */
  icon: string;
  /** One line for service cards. Calm, concrete. */
  purpose: string;
  /** Minimal first-screen copy. */
  hero: {
    heading: string;
    placeholder: string;
    button: string;
    /** Helper under the input. */
    helper?: string;
  };
  /** Default model tier for this service's synthesis step. */
  model: ModelPreference;
  /** ≤ a small set; the UI shows at most three at once. */
  refinements: string[];
  /** Optional inferred "modes" shown as a quiet note, never a required choice. */
  modes?: string[];
  capabilities: {
    acceptsFiles: boolean;
    acceptsLinks: boolean;
    /** Whether the service can fetch public pages server-side. */
    usesResearch: boolean;
    producesEmail: boolean;
    producesSlides: boolean;
    producesComparison: boolean;
    /** Whether claim classification is central (Verify/Challenge). */
    producesClaims: boolean;
    /** Show the non-advice disclaimer. */
    sensitive: boolean;
    /** Offer the Editorial Pass action. */
    editorial: boolean;
  };
};

export const SERVICE_GROUPS: { id: ServiceGroup; label: string }[] = [
  { id: "create", label: "Create" },
  { id: "intelligence", label: "Intelligence" },
  { id: "action", label: "Action" },
];

const base = {
  acceptsFiles: true,
  acceptsLinks: true,
  usesResearch: false,
  producesEmail: false,
  producesSlides: false,
  producesComparison: false,
  producesClaims: false,
  sensitive: false,
  editorial: false,
};

export const SERVICES: Record<ServiceId, ServiceConfig> = {
  write: {
    id: "write",
    group: "create",
    label: "Write",
    icon: "PenLine",
    purpose: "Turn rough notes and context into professional writing.",
    hero: {
      heading: "What do you need to write?",
      placeholder: "e.g. Draft a follow-up email from this thread.",
      button: "Create draft",
      helper: "Harbor infers the audience, tone, and format from what you add.",
    },
    model: "primary",
    refinements: ["Make it shorter", "Make it more direct", "Make it warmer", "Add evidence", "Turn this into an email"],
    capabilities: { ...base, producesEmail: true, editorial: true },
  },
  notes: {
    id: "notes",
    group: "create",
    label: "Notes",
    icon: "ListChecks",
    purpose: "Turn messy notes or a photo into clear structure.",
    hero: {
      heading: "What should Harbor make from this?",
      placeholder: "e.g. Turn these into a clear plan with next steps.",
      button: "Organize",
      helper: "Add a photo of handwriting and Harbor will read it first, locally.",
    },
    model: "fast",
    refinements: ["Make a checklist", "Make it a plan", "Pull out decisions", "Make it shorter"],
    modes: ["Clean notes", "Structured plan", "Checklist", "Meeting summary"],
    capabilities: { ...base },
  },
  present: {
    id: "present",
    group: "create",
    label: "Present",
    icon: "Presentation",
    purpose: "Shape an idea into a clear presentation storyline.",
    hero: {
      heading: "What are you trying to communicate?",
      placeholder: "e.g. A short deck to pitch this product to investors.",
      button: "Build presentation",
      helper: "Harbor drafts an 8–10 slide storyline you can edit and present.",
    },
    model: "primary",
    refinements: ["Fewer slides", "More evidence", "Sharper opening", "Stronger close"],
    capabilities: { ...base, producesSlides: true, editorial: true },
  },
  proposal: {
    id: "proposal",
    group: "create",
    label: "Proposal",
    icon: "FileText",
    purpose: "Turn client context into a credible, specific proposal.",
    hero: {
      heading: "What work are you proposing?",
      placeholder: "e.g. A 6-week brand refresh for this company.",
      button: "Build proposal",
      helper: "Add a company link, notes, or emails. Harbor separates facts from assumptions.",
    },
    model: "primary",
    refinements: ["Tighten scope", "Add a timeline", "Add pricing structure", "Draft the cover email"],
    capabilities: { ...base, usesResearch: true, producesEmail: true, editorial: true },
  },
  research: {
    id: "research",
    group: "intelligence",
    label: "Research",
    icon: "Telescope",
    purpose: "A source-backed briefing on a company or topic.",
    hero: {
      heading: "What do you want to understand?",
      placeholder: "e.g. Research this company before my meeting.",
      button: "Research",
      helper: "Add a company site or public links. Harbor reads only public pages.",
    },
    model: "primary",
    refinements: ["Focus on competitors", "Focus on risks", "Questions to ask", "Make it shorter"],
    modes: ["General brief", "Meeting prep", "Competitor scan", "Investor view"],
    capabilities: { ...base, usesResearch: true, producesClaims: true },
  },
  challenge: {
    id: "challenge",
    group: "intelligence",
    label: "Challenge",
    icon: "ShieldAlert",
    purpose: "Pressure-test a thesis, deal, proposal, or decision.",
    hero: {
      heading: "What should Harbor pressure-test?",
      placeholder: "e.g. Find the risks in this investment thesis.",
      button: "Find risks",
      helper: "Harbor labels each point as fact, claim, opinion, or open question.",
    },
    model: "reviewer",
    refinements: ["Strongest counterargument", "Missing evidence", "Diligence steps", "Questions to ask"],
    modes: ["Investment", "Partnership", "Product", "Hiring", "Communication", "Personal decision"],
    capabilities: { ...base, usesResearch: true, producesClaims: true },
  },
  verify: {
    id: "verify",
    group: "intelligence",
    label: "Verify",
    icon: "BadgeCheck",
    purpose: "Check whether the factual claims are supported.",
    hero: {
      heading: "What should Harbor verify?",
      placeholder: "e.g. Check the claims in this pitch are supported.",
      button: "Review claims",
      helper: "Add the text and any source links. Harbor reviews claim by claim.",
    },
    model: "primary",
    refinements: ["Only unsupported", "Suggest safer phrasing", "Show open questions"],
    capabilities: { ...base, usesResearch: true, producesClaims: true },
  },
  compare: {
    id: "compare",
    group: "intelligence",
    label: "Compare",
    icon: "Columns3",
    purpose: "Compare options side by side, with what matters.",
    hero: {
      heading: "What are you comparing?",
      placeholder: "e.g. Compare these two vendor proposals.",
      button: "Compare",
      helper: "Add the options as text, files, or links.",
    },
    model: "primary",
    refinements: ["Add a column", "What matters most", "Questions to ask", "Recommend a next step"],
    capabilities: { ...base, usesResearch: true, producesComparison: true },
  },
  brief: {
    id: "brief",
    group: "intelligence",
    label: "Brief",
    icon: "Newspaper",
    purpose: "A one-page briefing someone can read in 60 seconds.",
    hero: {
      heading: "What should this brief help someone understand?",
      placeholder: "e.g. Brief my partner on where this deal stands.",
      button: "Create brief",
      helper: "Add notes, links, or documents. Harbor keeps it to one page.",
    },
    model: "primary",
    refinements: ["Shorter", "Add risks", "Add next steps", "Read-in-60-seconds"],
    capabilities: { ...base, usesResearch: true, producesClaims: true, editorial: true },
  },
  meeting: {
    id: "meeting",
    group: "action",
    label: "Meeting",
    icon: "Users",
    purpose: "Prepare for a meeting, then help with follow-up.",
    hero: {
      heading: "What meeting are you preparing for?",
      placeholder: "e.g. Prepare me for a first call with this company.",
      button: "Prepare me",
      helper: "Add names, a company link, an agenda, or notes.",
    },
    model: "primary",
    refinements: ["Questions to ask", "Likely concerns", "Talking points", "Follow-up email"],
    capabilities: { ...base, usesResearch: true, producesEmail: true, editorial: true },
  },
  decide: {
    id: "decide",
    group: "action",
    label: "Decide",
    icon: "Scale",
    purpose: "Turn a messy situation into clear options and tradeoffs.",
    hero: {
      heading: "What decision are you trying to make?",
      placeholder: "e.g. Should we hire now or wait a quarter?",
      button: "Help me decide",
      helper: "Harbor won't be falsely certain when something important is missing.",
    },
    model: "primary",
    refinements: ["Add an option", "Weigh by risk", "What would change this", "Next step"],
    capabilities: { ...base, usesResearch: true },
  },
  explain: {
    id: "explain",
    group: "action",
    label: "Explain",
    icon: "BookOpen",
    purpose: "Translate a difficult document into plain English.",
    hero: {
      heading: "What should Harbor explain?",
      placeholder: "e.g. Explain what this contract means and what I need to do.",
      button: "Explain",
      helper: "Add the document. Harbor flags dates, actions, fees, and what needs a professional.",
    },
    model: "primary",
    refinements: ["What do I need to do", "Important dates", "What to ask a professional", "Shorter"],
    capabilities: { ...base, sensitive: true },
  },
};

export const SERVICE_LIST: ServiceConfig[] = Object.values(SERVICES);

export function serviceById(id: string): ServiceConfig | undefined {
  return (SERVICES as Record<string, ServiceConfig>)[id];
}

export function servicesByGroup(group: ServiceGroup): ServiceConfig[] {
  return SERVICE_LIST.filter((s) => s.group === group);
}

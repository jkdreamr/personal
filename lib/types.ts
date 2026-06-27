/**
 * Harbor shared domain types.
 *
 * Every service produces an `Artifact` of this shape. The generic renderer handles the
 * common fields; a few services add specialized payloads (slides, comparison, email).
 */

import type { ServiceId } from "./services";

export type TrustTier =
  | "primary"
  | "reputable_reporting"
  | "trade_press"
  | "community"
  | "user_provided";

export type Source = {
  id: string;
  title: string;
  canonicalUrl?: string;
  publisher?: string;
  retrievedAt: string; // ISO
  publishedAt?: string; // ISO
  trustTier: TrustTier;
  excerpt: string; // short, shown on the chip sheet
  content?: string; // longer extracted text, not exported by default
};

export type ClaimClassification =
  | "verified_fact"
  | "reported_claim"
  | "opinion"
  | "unresolved_question"
  | "not_sufficiently_supported";

export type Claim = {
  id: string;
  text: string;
  classification: ClaimClassification;
  sourceIds: string[];
  supportingExcerpts: string[];
  confidence: "high" | "medium" | "low";
};

/** A labelled block of the main artifact body. */
export type Section = {
  heading: string;
  /** Lightweight markdown (paragraphs, lists, bold). Rendered safely, never as raw HTML. */
  body: string;
  /** Optional emphasis for editorial layout. */
  kind?: "default" | "lead" | "list" | "callout";
};

export type SlideLayout =
  | "cover"
  | "thesis"
  | "problem"
  | "insight"
  | "timeline"
  | "comparison"
  | "framework"
  | "recommendation"
  | "closing";

export type Slide = {
  layout: SlideLayout;
  title: string;
  message: string; // core message / large statement
  bullets?: string[];
  evidence?: string[];
  speakerNotes?: string;
  visualDirection?: string;
};

export type ComparisonTable = {
  options: string[]; // column headers
  criteria: { label: string; values: string[] }[]; // rows aligned to options
  notes?: string;
};

export type EmailDraft = {
  subjectOptions: string[];
  body: string;
};

/** The universal output. */
export type Artifact = {
  service: ServiceId;
  title: string;
  /** One-line read-in-60-seconds summary. */
  summary?: string;
  sections: Section[];
  /** Things Harbor assumed, shown separately from facts. */
  assumptions?: string[];
  claims?: Claim[];
  sources?: Source[];
  openQuestions?: string[];
  nextActions?: string[];
  /** Plain-language non-advice disclaimer where relevant. */
  disclaimer?: string;
  /** A short, user-facing note of what Harbor did (never chain-of-thought). */
  coverageNote?: string;
  // Specialized payloads:
  email?: EmailDraft;
  slides?: Slide[];
  comparison?: ComparisonTable;
  /** True for demo-mode output; surfaced visibly in the UI. */
  demo?: boolean;
};

export type AttachmentKind = "text" | "file" | "link";

export type Attachment = {
  id: string;
  kind: AttachmentKind;
  /** Display name: filename, URL, or "Pasted text". */
  label: string;
  mime?: string;
  /** Extracted/normalized text content used as model context. */
  text: string;
  /** For files/images: original size and a note about extraction confidence. */
  meta?: {
    bytes?: number;
    pages?: number;
    ocr?: boolean;
    ocrConfidence?: number; // 0..1
    lowConfidence?: boolean;
    url?: string;
    /** Data URL preview for images (kept local). */
    previewDataUrl?: string;
    error?: string;
  };
};

/** Optional refinement state captured from the "Adjust this" controls. */
export type Adjustments = {
  tone?: string;
  length?: string;
  style?: string;
  confidence?: string;
  audience?: string;
  /** Free-form instruction from a refinement chip, e.g. "Make it shorter". */
  instruction?: string;
  /** Compare/Decide criteria. */
  criteria?: string;
  useVoiceProfile?: boolean;
  /** Explicit, user-requested adversarial review (routes to the reviewer model). */
  secondOpinion?: boolean;
};

export type StageId =
  | "received"
  | "understanding"
  | "sources"
  | "drafting"
  | "ready";

export type Stage = {
  id: StageId;
  label: string;
  state: "pending" | "active" | "done";
};

export type JobState = "idle" | "running" | "done" | "error" | "cancelled";

/** A unit of work in a workspace. */
export type Task = {
  id: string;
  workspaceId: string;
  service: ServiceId;
  title: string;
  goal: string; // the one sentence
  attachments: Attachment[];
  adjustments: Adjustments;
  artifact?: Artifact;
  /** User edits to the artifact body, kept separate so regeneration doesn't clobber them. */
  editedBody?: string;
  state: JobState;
  error?: string;
  createdAt: string;
  updatedAt: string;
};

export type Workspace = {
  id: string;
  title: string;
  service: ServiceId;
  createdAt: string;
  updatedAt: string;
};

export type VoiceProfile = {
  id: string;
  name: string;
  enabled: boolean;
  greeting?: string;
  signoff?: string;
  directness?: number; // 0..100
  formality?: number;
  warmth?: number;
  sentenceLength?: "short" | "medium" | "long";
  confidence?: number;
  favoritePhrases?: string[];
  wordsToAvoid?: string[];
  punctuation?: string;
  notes?: string;
  samples?: string[];
  createdAt: string;
  updatedAt: string;
};

export type UsageBudget = {
  /** YYYY-MM-DD */
  day: string;
  used: number;
  limit: number;
};

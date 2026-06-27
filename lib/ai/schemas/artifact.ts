import { z } from "zod";

/**
 * Zod schemas that validate model JSON into Harbor's Artifact shape.
 * Kept permissive on optionals (free models vary) but strict on structure.
 */

export const trustTierSchema = z.enum([
  "primary",
  "reputable_reporting",
  "trade_press",
  "community",
  "user_provided",
]);

export const claimClassificationSchema = z.enum([
  "verified_fact",
  "reported_claim",
  "opinion",
  "unresolved_question",
  "not_sufficiently_supported",
]);

export const sourceSchema = z.object({
  id: z.string(),
  title: z.string(),
  canonicalUrl: z.string().optional(),
  publisher: z.string().optional(),
  retrievedAt: z.string().optional(),
  publishedAt: z.string().optional(),
  trustTier: trustTierSchema.default("user_provided"),
  excerpt: z.string().default(""),
});

export const claimSchema = z.object({
  id: z.string().optional(),
  text: z.string(),
  classification: claimClassificationSchema,
  sourceIds: z.array(z.string()).default([]),
  supportingExcerpts: z.array(z.string()).default([]),
  confidence: z.enum(["high", "medium", "low"]).default("medium"),
});

export const sectionSchema = z.object({
  heading: z.string(),
  body: z.string(),
  kind: z.enum(["default", "lead", "list", "callout"]).optional(),
});

export const slideSchema = z.object({
  layout: z
    .enum([
      "cover",
      "thesis",
      "problem",
      "insight",
      "timeline",
      "comparison",
      "framework",
      "recommendation",
      "closing",
    ])
    .default("insight"),
  title: z.string(),
  message: z.string().default(""),
  bullets: z.array(z.string()).optional(),
  evidence: z.array(z.string()).optional(),
  speakerNotes: z.string().optional(),
  visualDirection: z.string().optional(),
});

export const comparisonSchema = z.object({
  options: z.array(z.string()),
  criteria: z.array(
    z.object({
      label: z.string(),
      values: z.array(z.string()),
    })
  ),
  notes: z.string().optional(),
});

export const emailSchema = z.object({
  subjectOptions: z.array(z.string()).default([]),
  body: z.string().default(""),
});

/** What the model is asked to return. Service/sources/demo are attached server-side. */
export const modelArtifactSchema = z.object({
  title: z.string(),
  summary: z.string().optional(),
  sections: z.array(sectionSchema).default([]),
  assumptions: z.array(z.string()).optional(),
  claims: z.array(claimSchema).optional(),
  openQuestions: z.array(z.string()).optional(),
  nextActions: z.array(z.string()).optional(),
  disclaimer: z.string().optional(),
  coverageNote: z.string().optional(),
  email: emailSchema.optional(),
  slides: z.array(slideSchema).optional(),
  comparison: comparisonSchema.optional(),
});

export type ModelArtifact = z.infer<typeof modelArtifactSchema>;

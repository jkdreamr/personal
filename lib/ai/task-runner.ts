import type { ServiceId } from "@/lib/services";
import { SERVICES } from "@/lib/services";
import type { Adjustments, Artifact, Attachment, Claim, Source, VoiceProfile } from "@/lib/types";
import { uid } from "@/lib/utils";
import { chatComplete, ProviderError, type ChatMessage } from "./openrouter-client";
import { generateDemoArtifact } from "./demo";
import { safeParseModelJson } from "./fallback";
import { fallbackChain, MODELS, routeModel, type ModelId } from "./model-router";
import { buildMessages } from "./prompts";
import { getCapabilities } from "./provider-capabilities";
import { modelArtifactSchema, type ModelArtifact } from "./schemas/artifact";

export type RunInput = {
  service: ServiceId;
  goal: string;
  attachments: Attachment[];
  sources: Source[];
  adjustments: Adjustments;
  voiceProfile?: VoiceProfile | null;
  signal?: AbortSignal;
};

export type RunResult = {
  artifact: Artifact;
  modelUsed: ModelId | "demo";
};

/**
 * Normalize raw model JSON into a durable Artifact: attach the service, ensure claim/source
 * ids, enforce the rule that a verified_fact must cite a real source (downgrade otherwise),
 * and only keep sources that exist.
 */
export function normalizeArtifact(raw: ModelArtifact, service: ServiceId, providedSources: Source[]): Artifact {
  const sourceById = new Map(providedSources.map((s) => [s.id, s]));
  const usedSourceIds = new Set<string>();

  const claims: Claim[] | undefined = raw.claims?.map((c) => {
    const validIds = c.sourceIds.filter((id) => sourceById.has(id));
    validIds.forEach((id) => usedSourceIds.add(id));
    let classification = c.classification;
    // A verified_fact with no real supporting source is downgraded — never assert unsupported facts.
    if (classification === "verified_fact" && validIds.length === 0) {
      classification = "not_sufficiently_supported";
    }
    return {
      id: c.id || uid("clm"),
      text: c.text,
      classification,
      sourceIds: validIds,
      supportingExcerpts: c.supportingExcerpts ?? [],
      confidence: c.confidence,
    };
  });

  // Keep all provided sources (the panel shows what Harbor read), ordered by use first.
  const sources = providedSources.length
    ? [...providedSources].sort((a, b) => Number(usedSourceIds.has(b.id)) - Number(usedSourceIds.has(a.id)))
    : undefined;

  return {
    service,
    title: raw.title?.trim() || `${SERVICES[service].label} draft`,
    summary: raw.summary,
    sections: raw.sections ?? [],
    assumptions: raw.assumptions,
    claims,
    sources,
    openQuestions: raw.openQuestions,
    nextActions: raw.nextActions,
    disclaimer: raw.disclaimer,
    coverageNote: raw.coverageNote,
    email: raw.email,
    slides: raw.slides,
    comparison: raw.comparison,
    demo: false,
  };
}

const REPAIR_INSTRUCTION =
  "Your previous reply was not valid JSON in the required shape. Reply again with ONE valid JSON object only, matching the schema. No prose, no code fences.";

/** Try one model: call, parse, validate. Returns null if it produced unusable output. */
async function tryModel(model: ModelId, messages: ChatMessage[], signal?: AbortSignal): Promise<ModelArtifact | null> {
  const caps = await getCapabilities(model, signal);
  const first = await chatComplete({
    model,
    messages,
    jsonMode: caps.jsonMode,
    temperature: 0.4,
    signal,
  });
  let parsed = safeParseModelJson(first);
  let result = modelArtifactSchema.safeParse(parsed);
  if (result.success) return result.data;

  // One repair retry, same model, asking for valid JSON. (Single retry only — no loops.)
  const repaired = await chatComplete({
    model,
    messages: [...messages, { role: "assistant", content: first.slice(0, 4000) }, { role: "user", content: REPAIR_INSTRUCTION }],
    jsonMode: caps.jsonMode,
    temperature: 0.2,
    signal,
  });
  parsed = safeParseModelJson(repaired);
  result = modelArtifactSchema.safeParse(parsed);
  return result.success ? result.data : null;
}

/**
 * Run a task. In demo mode (or with no key) this returns a locally-built artifact.
 * Otherwise it routes to the right model, validates, and falls back through approved
 * free models once. Transient provider errors retry at most once via the fallback chain.
 */
export async function runTask(input: RunInput, demo: boolean): Promise<RunResult> {
  if (demo) {
    return {
      artifact: generateDemoArtifact({
        service: input.service,
        goal: input.goal,
        attachments: input.attachments,
        adjustments: input.adjustments,
      }),
      modelUsed: "demo",
    };
  }

  const service = SERVICES[input.service];
  const preferred = routeModel(service.model, "synthesis");
  const messages = buildMessages({
    serviceId: input.service,
    goal: input.goal,
    attachments: input.attachments,
    sources: input.sources,
    adjustments: input.adjustments,
    voiceProfile: input.voiceProfile,
  });

  const chain = fallbackChain(preferred);
  let lastError: unknown = null;

  for (const model of chain) {
    try {
      const raw = await tryModel(model, messages, input.signal);
      if (raw) {
        return { artifact: normalizeArtifact(raw, input.service, input.sources), modelUsed: model };
      }
      // Parsed but invalid — move to next model in the chain.
      lastError = new ProviderError("The model did not return a usable result.", 502, true);
    } catch (err) {
      lastError = err;
      // Non-retryable (e.g. auth) or user cancellation: stop immediately.
      if (err instanceof ProviderError && !err.retryable) throw err;
      if (input.signal?.aborted) throw err;
      // Otherwise continue to the next approved free model (bounded by the chain length).
    }
  }

  throw lastError instanceof Error ? lastError : new ProviderError("The model is temporarily unavailable.", 503, true);
}

export { MODELS };

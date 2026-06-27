import type { ServiceId } from "@/lib/services";
import { SERVICES } from "@/lib/services";
import { serverEnv } from "@/lib/env";
import type { Adjustments, Artifact, Attachment, Claim, Source, VoiceProfile } from "@/lib/types";
import { uid } from "@/lib/utils";
import { chatComplete, ProviderError, type ChatMessage } from "./openrouter-client";
import { generateDemoArtifact } from "./demo";
import { safeParseModelJson } from "./fallback";
import { fallbackChain, MODELS, routeModel, type ModelId } from "./model-router";
import { buildMessages } from "./prompts";
import { getCapabilities } from "./provider-capabilities";
import { recordCall } from "./instrumentation";
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

  // Only keep specialized payloads a service is meant to produce, and never empty ones —
  // otherwise (e.g.) Verify renders a blank "Email" / "Comparison" the model emitted by habit.
  const caps = SERVICES[service].capabilities;
  const email =
    caps.producesEmail && raw.email && raw.email.body && raw.email.body.trim().length > 0 ? raw.email : undefined;
  const slides = caps.producesSlides && raw.slides && raw.slides.length > 0 ? raw.slides : undefined;
  const comparison =
    caps.producesComparison && raw.comparison && raw.comparison.criteria && raw.comparison.criteria.length > 0
      ? raw.comparison
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
    email,
    slides,
    comparison,
    demo: false,
  };
}

const REPAIR_INSTRUCTION =
  "Your previous reply was not valid JSON in the required shape. Reply again with ONE valid JSON object only, matching the schema. No prose, no code fences.";

type Meter = { onCall: () => void; onUsage: (n: number) => void };

/** Try one model: call, parse, validate. Returns null if it produced unusable output. */
async function tryModel(model: ModelId, messages: ChatMessage[], meter: Meter, signal?: AbortSignal): Promise<ModelArtifact | null> {
  const caps = await getCapabilities(model, signal);
  meter.onCall();
  const first = await chatComplete({
    model,
    messages,
    jsonMode: caps.jsonMode,
    temperature: 0.4,
    signal,
    onUsage: meter.onUsage,
  });
  let parsed = safeParseModelJson(first);
  let result = modelArtifactSchema.safeParse(parsed);
  if (result.success) return result.data;

  // One repair retry, same model, asking for valid JSON. (Single retry only — no loops.)
  meter.onCall();
  const repaired = await chatComplete({
    model,
    messages: [...messages, { role: "assistant", content: first.slice(0, 4000) }, { role: "user", content: REPAIR_INSTRUCTION }],
    jsonMode: caps.jsonMode,
    temperature: 0.2,
    signal,
    onUsage: meter.onUsage,
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
  // Owl Alpha by default; only an explicit "second opinion" routes to the reviewer model.
  const preferred = routeModel(service.model, input.adjustments.secondOpinion ? "second_opinion" : "synthesis");
  const messages = buildMessages({
    serviceId: input.service,
    goal: input.goal,
    attachments: input.attachments,
    sources: input.sources,
    adjustments: input.adjustments,
    voiceProfile: input.voiceProfile,
  });

  // Owl -> GPT-OSS -> Nemotron, then optional cross-provider Mistral (free) as a last resort.
  const chain = [...fallbackChain(preferred), ...(serverEnv.mistralKey ? [MODELS.mistral] : [])];
  let lastError: unknown = null;

  // Owner-only instrumentation (no content stored).
  let calls = 0;
  let tokens = 0;
  const meter: Meter = { onCall: () => (calls += 1), onUsage: (n) => (tokens += n) };

  for (const model of chain) {
    try {
      const raw = await tryModel(model, messages, meter, input.signal);
      if (raw) {
        recordCall({ taskType: input.service, model, calls, success: true, rateLimited: false, tokens: tokens || undefined });
        return { artifact: normalizeArtifact(raw, input.service, input.sources), modelUsed: model };
      }
      // Parsed but invalid — move to next model in the chain.
      lastError = new ProviderError("The model did not return a usable result.", 502, true);
    } catch (err) {
      lastError = err;
      // Only a bad/again-missing API key (auth) or user cancellation is fatal — abort then.
      // Everything else (model-not-found, bad request, rate limit, 5xx, timeout) falls through
      // to the next model in the chain, because one flaky model shouldn't kill the whole task.
      if (err instanceof ProviderError && (err.status === 401 || err.status === 403)) {
        recordCall({ taskType: input.service, model, calls, success: false, rateLimited: false, errorStatus: err.status, tokens: tokens || undefined });
        throw err;
      }
      if (input.signal?.aborted) throw err;
      // Otherwise continue to the next approved free model (bounded by the chain length).
    }
  }

  const rateLimited = lastError instanceof ProviderError && lastError.status === 429;
  recordCall({
    taskType: input.service,
    model: preferred,
    calls,
    success: false,
    rateLimited,
    errorStatus: lastError instanceof ProviderError ? lastError.status : undefined,
    tokens: tokens || undefined,
  });
  throw lastError instanceof Error ? lastError : new ProviderError("The model is temporarily unavailable.", 503, true);
}

export { MODELS };

import { serverEnv } from "@/lib/env";
import type { ModelId } from "./model-router";

/**
 * Provider capability checks. We do NOT assume free models support structured output,
 * tools, or streaming. Capabilities are queried from OpenRouter's /models endpoint and
 * cached in-process. When unknown, we assume the safe minimum (no json mode) and rely on
 * prompt-based JSON + robust extraction + Zod validation instead.
 */

export type Capabilities = {
  jsonMode: boolean;
  imageInput: boolean;
};

type CacheEntry = { value: Capabilities; expires: number };
const cache = new Map<string, CacheEntry>();
const TTL_MS = 30 * 60 * 1000;

const SAFE_DEFAULT: Capabilities = { jsonMode: false, imageInput: false };

let modelsIndex: Map<string, { jsonMode: boolean; imageInput: boolean }> | null = null;
let modelsIndexExpires = 0;

async function loadModelsIndex(signal?: AbortSignal): Promise<void> {
  if (modelsIndex && Date.now() < modelsIndexExpires) return;
  if (!serverEnv.openRouterKey) return;
  try {
    const res = await fetch("https://openrouter.ai/api/v1/models", {
      headers: { Authorization: `Bearer ${serverEnv.openRouterKey}` },
      signal,
    });
    if (!res.ok) return;
    const data = (await res.json()) as { data?: ModelRecord[] };
    const index = new Map<string, { jsonMode: boolean; imageInput: boolean }>();
    for (const m of data.data ?? []) {
      const params: string[] = m.supported_parameters ?? [];
      const inputs: string[] = m.architecture?.input_modalities ?? [];
      index.set(m.id, {
        jsonMode: params.includes("response_format") || params.includes("structured_outputs"),
        imageInput: inputs.includes("image"),
      });
    }
    modelsIndex = index;
    modelsIndexExpires = Date.now() + TTL_MS;
  } catch {
    // Network/parse failure → leave index null, capabilities fall back to safe default.
  }
}

type ModelRecord = {
  id: string;
  supported_parameters?: string[];
  architecture?: { input_modalities?: string[] };
};

/** Get capabilities for a model, querying + caching as needed. Never throws. */
export async function getCapabilities(model: ModelId, signal?: AbortSignal): Promise<Capabilities> {
  const cached = cache.get(model);
  if (cached && Date.now() < cached.expires) return cached.value;

  await loadModelsIndex(signal);
  const found = modelsIndex?.get(model);
  const value: Capabilities = found ? { jsonMode: found.jsonMode, imageInput: found.imageInput } : SAFE_DEFAULT;

  cache.set(model, { value, expires: Date.now() + TTL_MS });
  return value;
}

/** Test seam: clear caches. */
export function __resetCapabilityCache(): void {
  cache.clear();
  modelsIndex = null;
  modelsIndexExpires = 0;
}

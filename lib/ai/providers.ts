import { serverEnv } from "@/lib/env";

/**
 * Multi-provider resolution. Every provider here exposes an OpenAI-compatible
 * `/chat/completions` path, so the client only needs the right base URL, key, and headers.
 *
 * Model id convention: extra providers are tagged `"<provider>::<model>"` (e.g.
 * `"groq::llama-3.3-70b-versatile"`). OpenRouter ids stay native (they contain `/` and `:free`).
 * Mistral is recognised by its `mistral-*` model names. All providers used here have free tiers
 * at $0 — Harbor never calls a paid model (enforced by assertFreeModel).
 */

export type ProviderId = "openrouter" | "mistral" | "groq" | "cerebras" | "google";

type ProviderConfig = {
  url: string;
  key: () => string;
  headers: Record<string, string>;
};

const PROVIDERS: Record<ProviderId, ProviderConfig> = {
  openrouter: {
    url: "https://openrouter.ai/api/v1/chat/completions",
    key: () => serverEnv.openRouterKey,
    headers: { "HTTP-Referer": "https://harbor.app", "X-Title": "Harbor" },
  },
  mistral: { url: "https://api.mistral.ai/v1/chat/completions", key: () => serverEnv.mistralKey, headers: {} },
  groq: { url: "https://api.groq.com/openai/v1/chat/completions", key: () => serverEnv.groqKey, headers: {} },
  cerebras: { url: "https://api.cerebras.ai/v1/chat/completions", key: () => serverEnv.cerebrasKey, headers: {} },
  google: {
    url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    key: () => serverEnv.geminiKey,
    headers: {},
  },
};

/** The provider that serves a given model id. */
export function providerForModel(modelId: string): ProviderId {
  const sep = modelId.indexOf("::");
  if (sep !== -1) {
    const tag = modelId.slice(0, sep) as ProviderId;
    if (tag in PROVIDERS) return tag;
  }
  if (modelId.startsWith("mistral-") || modelId.startsWith("open-mistral") || modelId.startsWith("open-mixtral")) {
    return "mistral";
  }
  return "openrouter";
}

export function providerEnabled(id: ProviderId): boolean {
  return PROVIDERS[id].key().length > 0;
}

/** True when the provider that serves this model has a key configured. */
export function modelEnabled(modelId: string): boolean {
  return providerEnabled(providerForModel(modelId));
}

/** Resolve a (possibly tagged) model id to its endpoint, key, headers, and bare model name. */
export function endpointFor(modelId: string): { url: string; key: string; headers: Record<string, string>; model: string } {
  const provider = providerForModel(modelId);
  const cfg = PROVIDERS[provider];
  const sep = modelId.indexOf("::");
  const model = sep !== -1 ? modelId.slice(sep + 2) : modelId;
  return { url: cfg.url, key: cfg.key(), headers: cfg.headers, model };
}

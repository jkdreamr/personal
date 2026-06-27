import { serverEnv } from "@/lib/env";
import { assertFreeModel } from "./model-router";

/**
 * Minimal multi-provider chat-completions client. Server-side only; keys never leave the server.
 * Both OpenRouter and Mistral expose the same OpenAI-compatible path, so we just pick the right
 * endpoint, key, and headers per model. Mistral (id `mistral-*`) is an optional free fallback.
 */

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MISTRAL_URL = "https://api.mistral.ai/v1/chat/completions";

function isMistralModel(model: string): boolean {
  return model.startsWith("mistral-") || model.startsWith("open-mistral") || model.startsWith("open-mixtral");
}

/** Resolve the endpoint URL, key, and provider-specific headers for a model. */
function endpointFor(model: string): { url: string; key: string; headers: Record<string, string> } {
  if (isMistralModel(model)) {
    return { url: MISTRAL_URL, key: serverEnv.mistralKey, headers: {} };
  }
  return {
    url: OPENROUTER_URL,
    key: serverEnv.openRouterKey,
    headers: { "HTTP-Referer": "https://harbor.app", "X-Title": "Harbor" },
  };
}

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type ChatRequest = {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  /** Only sent when the model is known to support it. */
  jsonMode?: boolean;
  signal?: AbortSignal;
  timeoutMs?: number;
  /** Reports approximate token usage when the provider includes it. */
  onUsage?: (totalTokens: number) => void;
};

export class ProviderError extends Error {
  status: number;
  retryable: boolean;
  constructor(message: string, status: number, retryable: boolean) {
    super(message);
    this.name = "ProviderError";
    this.status = status;
    this.retryable = retryable;
  }
}

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

/**
 * Single chat completion. Returns the assistant message text.
 * Throws ProviderError on failure (with a retryable flag for transient cases).
 */
export async function chatComplete(req: ChatRequest): Promise<string> {
  const endpoint = endpointFor(req.model);
  if (!endpoint.key) {
    throw new ProviderError("No API key configured for this model's provider.", 500, false);
  }
  assertFreeModel(req.model); // hard guard: never incur per-token cost

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), req.timeoutMs ?? 45_000);
  // Chain an externally-provided signal (e.g. user cancellation).
  if (req.signal) {
    if (req.signal.aborted) controller.abort();
    else req.signal.addEventListener("abort", () => controller.abort(), { once: true });
  }

  const body: Record<string, unknown> = {
    model: req.model,
    messages: req.messages,
    temperature: req.temperature ?? 0.4,
    max_tokens: req.maxTokens ?? 2400,
  };
  if (req.jsonMode) {
    body.response_format = { type: "json_object" };
  }

  let res: Response;
  try {
    res = await fetch(endpoint.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${endpoint.key}`,
        "Content-Type": "application/json",
        ...endpoint.headers,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeout);
    const aborted = err instanceof Error && err.name === "AbortError";
    throw new ProviderError(aborted ? "The request was cancelled or timed out." : "Could not reach the model provider.", 503, !aborted);
  }
  clearTimeout(timeout);

  if (!res.ok) {
    let detail = "";
    try {
      const j = await res.json();
      detail = j?.error?.message ?? "";
    } catch {
      /* ignore */
    }
    throw new ProviderError(detail || `Provider returned ${res.status}.`, res.status, isRetryableStatus(res.status));
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
    usage?: { total_tokens?: number };
  };
  if (req.onUsage && typeof data.usage?.total_tokens === "number") {
    req.onUsage(data.usage.total_tokens);
  }
  const content = data?.choices?.[0]?.message?.content;
  if (!content || typeof content !== "string") {
    throw new ProviderError("The model returned an empty response.", 502, true);
  }
  return content;
}

/**
 * Streaming chat completion (Server-Sent Events). Calls `onDelta` with each text chunk as it
 * arrives and resolves with the full text. This is what makes results feel fast — the first
 * words appear in ~1s instead of waiting for the whole response.
 */
export async function chatCompleteStream(req: ChatRequest, onDelta: (text: string) => void): Promise<string> {
  const endpoint = endpointFor(req.model);
  if (!endpoint.key) {
    throw new ProviderError("No API key configured for this model's provider.", 500, false);
  }
  assertFreeModel(req.model); // hard guard: never incur per-token cost

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), req.timeoutMs ?? 60_000);
  if (req.signal) {
    if (req.signal.aborted) controller.abort();
    else req.signal.addEventListener("abort", () => controller.abort(), { once: true });
  }

  let res: Response;
  try {
    res = await fetch(endpoint.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${endpoint.key}`,
        "Content-Type": "application/json",
        ...endpoint.headers,
      },
      body: JSON.stringify({
        model: req.model,
        messages: req.messages,
        temperature: req.temperature ?? 0.4,
        max_tokens: req.maxTokens ?? 2400,
        stream: true,
        ...(req.jsonMode ? { response_format: { type: "json_object" } } : {}),
      }),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeout);
    const aborted = err instanceof Error && err.name === "AbortError";
    throw new ProviderError(aborted ? "The request was cancelled or timed out." : "Could not reach the model provider.", 503, !aborted);
  }

  if (!res.ok || !res.body) {
    clearTimeout(timeout);
    let detail = "";
    try {
      detail = (await res.json())?.error?.message ?? "";
    } catch {
      /* ignore */
    }
    throw new ProviderError(detail || `Provider returned ${res.status}.`, res.status, isRetryableStatus(res.status));
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (!line || !line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (payload === "[DONE]") continue;
        try {
          const json = JSON.parse(payload) as {
            choices?: { delta?: { content?: string } }[];
            usage?: { total_tokens?: number };
          };
          const delta = json.choices?.[0]?.delta?.content;
          if (delta) {
            full += delta;
            onDelta(delta);
          }
          if (req.onUsage && typeof json.usage?.total_tokens === "number") req.onUsage(json.usage.total_tokens);
        } catch {
          /* skip malformed keep-alive lines */
        }
      }
    }
  } finally {
    clearTimeout(timeout);
  }

  if (!full) throw new ProviderError("The model returned an empty response.", 502, true);
  return full;
}

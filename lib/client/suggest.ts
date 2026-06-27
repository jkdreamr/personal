import type { SuggestResponse } from "@/lib/ai/suggest-schema";

/** Request editorial suggestions for the current draft. Returns empty on any failure (best-effort). */
export async function fetchSuggestions(
  input: { text: string; goal?: string; context?: string; service?: string; tone?: string; length?: string },
  signal?: AbortSignal
): Promise<SuggestResponse> {
  try {
    const res = await fetch("/api/suggest", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
      signal,
    });
    if (!res.ok) return { suggestions: [], overall: [] };
    const data = await res.json();
    return { suggestions: Array.isArray(data.suggestions) ? data.suggestions : [], overall: Array.isArray(data.overall) ? data.overall : [] };
  } catch {
    return { suggestions: [], overall: [] };
  }
}

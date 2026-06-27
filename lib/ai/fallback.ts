/**
 * Robust extraction of a JSON object from model text. Free models may wrap JSON in
 * prose, code fences, or trailing commentary. This pulls out the first balanced
 * top-level object and tolerates common defects.
 */

export function extractJsonObject(text: string): string | null {
  if (!text) return null;

  // Prefer a fenced ```json block if present.
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fence ? fence[1] : text;

  const start = candidate.indexOf("{");
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < candidate.length; i++) {
    const ch = candidate[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === "\\") {
      escape = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        return candidate.slice(start, i + 1);
      }
    }
  }
  return null;
}

/** Remove trailing commas which some models emit, then JSON.parse. */
export function parseLooseJson(raw: string): unknown {
  const cleaned = raw
    // strip // line comments
    .replace(/^\s*\/\/.*$/gm, "")
    // strip trailing commas before } or ]
    .replace(/,(\s*[}\]])/g, "$1");
  return JSON.parse(cleaned);
}

/** Convenience: extract + parse, returning null on any failure. */
export function safeParseModelJson(text: string): unknown | null {
  try {
    const obj = extractJsonObject(text);
    if (!obj) return null;
    return parseLooseJson(obj);
  } catch {
    return null;
  }
}

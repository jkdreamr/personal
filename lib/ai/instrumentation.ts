/**
 * Owner-only model-call instrumentation. Best-effort, in-memory ring buffer (resets on a
 * cold start in serverless — this is diagnostics, not billing). No prompts or content are
 * ever stored — only task type, model, counts, outcome, and approximate token usage.
 */

export type CallRecord = {
  /** ms since epoch, stamped by the recorder. */
  at: number;
  taskType: string;
  model: string;
  calls: number;
  success: boolean;
  rateLimited: boolean;
  /** Approximate total tokens when the provider reported usage. */
  tokens?: number;
  errorStatus?: number;
};

const MAX = 200;
const buffer: CallRecord[] = [];

let monotonic = 0;
/** Stamp without Date.now() at module init friendliness; uses Date.now at call time only. */
export function recordCall(rec: Omit<CallRecord, "at">): void {
  buffer.push({ ...rec, at: Date.now() });
  monotonic++;
  if (buffer.length > MAX) buffer.splice(0, buffer.length - MAX);
}

export function getRecentCalls(): CallRecord[] {
  return [...buffer].reverse();
}

export function getSummary() {
  const byModel: Record<string, { calls: number; tasks: number; failures: number; rateLimited: number; tokens: number }> = {};
  for (const r of buffer) {
    const m = (byModel[r.model] ??= { calls: 0, tasks: 0, failures: 0, rateLimited: 0, tokens: 0 });
    m.calls += r.calls;
    m.tasks += 1;
    if (!r.success) m.failures += 1;
    if (r.rateLimited) m.rateLimited += 1;
    m.tokens += r.tokens ?? 0;
  }
  return { total: monotonic, retained: buffer.length, byModel };
}

"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";

type Summary = {
  total: number;
  retained: number;
  byModel: Record<string, { calls: number; tasks: number; failures: number; rateLimited: number; tokens: number }>;
};
type Recent = {
  at: number;
  taskType: string;
  model: string;
  calls: number;
  success: boolean;
  rateLimited: boolean;
  tokens?: number;
  errorStatus?: number;
};

/**
 * Owner-only diagnostics. Not linked anywhere. Requires the DIAGNOSTICS_TOKEN value.
 * Shows model-call instrumentation — never prompts or content.
 */
export default function DiagnosticsPage() {
  const [token, setToken] = React.useState("");
  const [data, setData] = React.useState<{ demo: boolean; summary: Summary; recent: Recent[] } | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const load = async () => {
    setError(null);
    const res = await fetch(`/api/diagnostics?token=${encodeURIComponent(token)}`, { cache: "no-store" });
    if (res.status === 404) return setError("Diagnostics are disabled (set DIAGNOSTICS_TOKEN).");
    if (!res.ok) return setError("That token wasn't accepted.");
    setData(await res.json());
  };

  return (
    <div className="mx-auto max-w-3xl px-5 py-8 sm:px-6">
      <h1 className="text-2xl font-semibold text-ink">Diagnostics</h1>
      <p className="mt-1 text-sm text-muted">Owner-only. Model-call instrumentation. No prompts or content are stored.</p>

      <div className="mt-5 flex items-end gap-2">
        <div className="flex-1">
          <Label htmlFor="tok">Diagnostics token</Label>
          <Input id="tok" type="password" className="mt-1.5" value={token} onChange={(e) => setToken(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()} />
        </div>
        <Button onClick={load} disabled={!token.trim()}>Load</Button>
      </div>
      {error && <p className="mt-3 text-sm text-danger" role="alert">{error}</p>}

      {data && (
        <div className="mt-6 space-y-6">
          <p className="text-sm text-muted">Mode: {data.demo ? "demo (no key)" : "live"} · {data.summary.total} calls total, {data.summary.retained} retained in memory.</p>
          <div>
            <p className="mb-2 text-sm font-medium text-ink">By model</p>
            <div className="overflow-x-auto rounded-card border border-line">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line bg-surface/60 text-left">
                    <th className="p-2 font-medium">Model</th><th className="p-2 font-medium">Tasks</th><th className="p-2 font-medium">Calls</th><th className="p-2 font-medium">Failures</th><th className="p-2 font-medium">Rate-limited</th><th className="p-2 font-medium">~Tokens</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(data.summary.byModel).map(([m, s]) => (
                    <tr key={m} className="border-b border-line last:border-0">
                      <td className="p-2 font-mono text-meta">{m}</td><td className="p-2 tnum">{s.tasks}</td><td className="p-2 tnum">{s.calls}</td><td className="p-2 tnum">{s.failures}</td><td className="p-2 tnum">{s.rateLimited}</td><td className="p-2 tnum">{s.tokens || "—"}</td>
                    </tr>
                  ))}
                  {Object.keys(data.summary.byModel).length === 0 && <tr><td className="p-2 text-muted" colSpan={6}>No calls recorded yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
          <div>
            <p className="mb-2 text-sm font-medium text-ink">Recent calls</p>
            <ul className="space-y-1 text-meta">
              {data.recent.slice(0, 40).map((r, i) => (
                <li key={i} className="flex items-center gap-3 rounded-btn border border-line px-2.5 py-1.5">
                  <span className="w-32 shrink-0 text-muted tnum">{new Date(r.at).toLocaleTimeString()}</span>
                  <span className="w-20 shrink-0">{r.taskType}</span>
                  <span className="flex-1 truncate font-mono">{r.model}</span>
                  <span className="tnum">{r.calls} call{r.calls === 1 ? "" : "s"}</span>
                  <span className={r.success ? "text-success" : "text-danger"}>{r.success ? "ok" : r.rateLimited ? "rate-limited" : `error${r.errorStatus ? " " + r.errorStatus : ""}`}</span>
                  <span className="w-16 shrink-0 text-right tnum text-muted">{r.tokens ?? "—"}</span>
                </li>
              ))}
              {data.recent.length === 0 && <li className="text-muted">No calls recorded yet (resets on cold start).</li>}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import type { ComparisonTable } from "@/lib/types";

/** Responsive comparison: a real table on wider screens, stacked cards on mobile. */
export function ComparisonView({ table }: { table: ComparisonTable }) {
  return (
    <div>
      {/* Table (sm and up) */}
      <div className="hidden overflow-x-auto rounded-card border border-line sm:block">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-line bg-surface/60">
              <th className="p-3 text-left font-semibold text-ink">Criteria</th>
              {table.options.map((o, i) => (
                <th key={i} className="p-3 text-left font-semibold text-ink">
                  {o}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.criteria.map((row, ri) => (
              <tr key={ri} className="avoid-break border-b border-line last:border-0">
                <th scope="row" className="p-3 text-left align-top font-medium text-ink/90">
                  {row.label}
                </th>
                {row.values.map((v, vi) => (
                  <td key={vi} className="p-3 align-top text-ink/85">
                    {v || "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Stacked cards (mobile) */}
      <div className="space-y-3 sm:hidden">
        {table.options.map((o, oi) => (
          <div key={oi} className="rounded-card border border-line p-3">
            <p className="font-semibold text-ink">{o}</p>
            <dl className="mt-2 space-y-1.5">
              {table.criteria.map((row, ri) => (
                <div key={ri} className="text-sm">
                  <dt className="text-meta uppercase tracking-wide text-muted">{row.label}</dt>
                  <dd className="text-ink/85">{row.values[oi] || "—"}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>

      {table.notes && <p className="mt-3 text-sm text-muted">{table.notes}</p>}
    </div>
  );
}

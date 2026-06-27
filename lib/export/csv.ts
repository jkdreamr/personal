import type { ComparisonTable } from "@/lib/types";

function escapeCsvCell(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

/** Comparison table → CSV. First column is the criteria label. */
export function comparisonToCsv(table: ComparisonTable): string {
  const header = ["Criteria", ...table.options].map(escapeCsvCell).join(",");
  const rows = table.criteria.map((row) => [row.label, ...row.values].map(escapeCsvCell).join(","));
  return [header, ...rows].join("\n") + "\n";
}

/** Comparison table → TSV (tab-separated, paste-into-sheet friendly). */
export function comparisonToTsv(table: ComparisonTable): string {
  const clean = (s: string) => s.replace(/\t/g, " ").replace(/\n/g, " ");
  const header = ["Criteria", ...table.options].map(clean).join("\t");
  const rows = table.criteria.map((row) => [row.label, ...row.values].map(clean).join("\t"));
  return [header, ...rows].join("\n") + "\n";
}

"use client";

import * as React from "react";
import { ChevronDown, RotateCw } from "lucide-react";
import type { Adjustments, Attachment } from "@/lib/types";
import type { ServiceConfig } from "@/lib/services";
import { Eyebrow } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { Textarea, Label } from "@/components/ui/field";
import { AttachmentAdder } from "./AttachmentAdder";
import { AttachmentList } from "./AttachmentList";
import { cn } from "@/lib/utils";

const TONE = ["Direct", "Professional", "Formal"];
const LENGTH = ["Short", "Balanced", "Thorough"];
const STYLE = ["Clear", "Conversational", "Polished"];
const CONFIDENCE = ["Cautious", "Balanced", "Decisive"];

function Select({ label, value, options, onChange }: { label: string; value?: string; options: string[]; onChange: (v: string) => void }) {
  const id = `sel-${label.toLowerCase()}`;
  return (
    <div>
      <Label htmlFor={id} className="text-meta text-muted">
        {label}
      </Label>
      <select
        id={id}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-btn border border-line bg-surface px-2.5 py-2 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/70"
      >
        <option value="">Auto</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}

export function ContextPanel({
  service,
  goal,
  attachments,
  adjustments,
  assumptions,
  hasResult,
  running,
  onGoal,
  onAttachments,
  onAdjust,
  onRefine,
  onApplyAdjustments,
  onSecondOpinion,
}: {
  service: ServiceConfig;
  goal: string;
  attachments: Attachment[];
  adjustments: Adjustments;
  assumptions?: string[];
  hasResult: boolean;
  running: boolean;
  onGoal: (g: string) => void;
  onAttachments: (a: Attachment[]) => void;
  onAdjust: (a: Adjustments) => void;
  onRefine: (instruction: string) => void;
  onApplyAdjustments: () => void;
  onSecondOpinion?: () => void;
}) {
  const [adjustOpen, setAdjustOpen] = React.useState(false);
  const quickRefinements = service.refinements.slice(0, 3);
  const offersSecondOpinion = service.capabilities.producesClaims || service.id === "decide";

  const setAdj = (patch: Partial<Adjustments>) => onAdjust({ ...adjustments, ...patch });

  return (
    <div className="space-y-6">
      <section>
        <Eyebrow>What you asked for</Eyebrow>
        <Textarea
          aria-label="Task goal"
          className="mt-2 min-h-[64px] text-sm"
          value={goal}
          placeholder={service.hero.placeholder}
          onChange={(e) => onGoal(e.target.value)}
        />
      </section>

      <section>
        <div className="flex items-center justify-between">
          <Eyebrow>Context</Eyebrow>
          {attachments.length > 0 && <span className="text-meta text-muted">{attachments.length} attached</span>}
        </div>
        <AttachmentList attachments={attachments} onChange={onAttachments} className="mt-2" />
        <div className="mt-3">
          <AttachmentAdder
            attachments={attachments}
            onChange={onAttachments}
            acceptsFiles={service.capabilities.acceptsFiles}
            acceptsLinks={service.capabilities.acceptsLinks}
            compact
          />
        </div>
      </section>

      {assumptions && assumptions.length > 0 && (
        <section>
          <Eyebrow>Harbor assumed</Eyebrow>
          <ul className="mt-2 space-y-1.5 text-sm text-ink/80">
            {assumptions.map((a, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-muted">·</span>
                <span>{a}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {hasResult && (
        <section>
          <Eyebrow>Refine</Eyebrow>
          <Button variant="secondary" size="sm" className="mt-2 w-full" onClick={onApplyAdjustments} disabled={running}>
            <RotateCw className="h-4 w-4" /> Regenerate
          </Button>
          <div className="mt-2 flex flex-wrap gap-2">
            {quickRefinements.map((r) => (
              <button
                key={r}
                disabled={running}
                onClick={() => onRefine(r)}
                className="rounded-chip border border-line bg-surface px-2.5 py-1.5 text-meta font-medium text-ink hover:bg-ink/[0.05] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/70"
              >
                {r}
              </button>
            ))}
          </div>

          {offersSecondOpinion && onSecondOpinion && (
            <button
              onClick={onSecondOpinion}
              disabled={running}
              className="mt-2 block w-full rounded-chip border border-line bg-surface px-2.5 py-1.5 text-left text-meta font-medium text-ink hover:bg-ink/[0.05] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/70"
            >
              Get a second opinion (deeper review)
            </button>
          )}

          <button
            onClick={() => setAdjustOpen((o) => !o)}
            className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-ink/80 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/70 rounded"
            aria-expanded={adjustOpen}
          >
            <ChevronDown className={cn("h-4 w-4 transition-transform", adjustOpen && "rotate-180")} />
            Adjust this
          </button>

          {adjustOpen && (
            <div className="mt-3 space-y-3">
              {service.capabilities.editorial && (
                <div className="grid grid-cols-2 gap-2">
                  <Select label="Tone" value={adjustments.tone} options={TONE} onChange={(v) => setAdj({ tone: v || undefined })} />
                  <Select label="Length" value={adjustments.length} options={LENGTH} onChange={(v) => setAdj({ length: v || undefined })} />
                  <Select label="Style" value={adjustments.style} options={STYLE} onChange={(v) => setAdj({ style: v || undefined })} />
                  <Select label="Confidence" value={adjustments.confidence} options={CONFIDENCE} onChange={(v) => setAdj({ confidence: v || undefined })} />
                </div>
              )}
              {service.refinements.length > 3 && (
                <div className="flex flex-wrap gap-2">
                  {service.refinements.slice(3).map((r) => (
                    <button
                      key={r}
                      disabled={running}
                      onClick={() => onRefine(r)}
                      className="rounded-chip border border-line bg-surface px-2.5 py-1.5 text-meta font-medium text-ink hover:bg-ink/[0.05] disabled:opacity-50"
                    >
                      {r}
                    </button>
                  ))}
                </div>
              )}
              <Button size="sm" variant="secondary" onClick={onApplyAdjustments} disabled={running} className="w-full">
                Apply changes
              </Button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

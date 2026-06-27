"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Sparkle, Check } from "lucide-react";
import { inferIntent, shouldAutoProceed } from "@/lib/intent";
import { SERVICES, type ServiceId } from "@/lib/services";
import type { Attachment } from "@/lib/types";
import { newTask, saveTask } from "@/lib/db/tasks";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { AttachmentAdder } from "@/components/workspace/AttachmentAdder";
import { ServiceIcon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

const EXAMPLES: { label: string; goal: string; service: ServiceId; sample?: string }[] = [
  {
    label: "Reply to an email",
    goal: "Draft a warm but brief reply to this email.",
    service: "write",
    sample:
      "From: Dana Whitfield\nSubject: Re: timing for the pilot\n\nHi — thanks for sending the overview. The board liked the direction. Can you confirm whether a March start is realistic, and what you'd need from us to hit it? Also curious how you'd handle the data migration. — Dana",
  },
  {
    label: "Prep for a meeting",
    goal: "Research this company before my meeting tomorrow.",
    service: "meeting",
  },
  {
    label: "Explain a document",
    goal: "Explain what this says and what I need to do.",
    service: "explain",
    sample:
      "NOTICE OF RENEWAL. Your policy 4471-A renews on 2026-08-01. The annual premium is $2,340, due within 30 days of the renewal date. A late fee of $45 applies after the due date. Coverage limits and the $1,000 deductible remain unchanged. To cancel, written notice is required 14 days before renewal.",
  },
];

export function HomeIntake() {
  const router = useRouter();
  const [goal, setGoal] = React.useState("");
  const [attachments, setAttachments] = React.useState<Attachment[]>([]);
  const [override, setOverride] = React.useState<ServiceId | null>(null);
  const [demoExample, setDemoExample] = React.useState(false);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const guess = React.useMemo(() => {
    const kinds = attachments.map((a) => a.kind);
    return inferIntent({
      text: goal,
      attachmentKinds: kinds,
      hasImage: attachments.some((a) => a.meta?.ocr || a.mime?.startsWith("image/")),
      hasEmail: attachments.some((a) => a.mime === "message/rfc822") || /from:|subject:/i.test(goal + attachments.map((a) => a.text).join(" ")),
      itemCount: attachments.filter((a) => a.kind !== "text" || a.text.length > 0).length || (goal ? 1 : 0),
    });
  }, [goal, attachments]);

  const chosen: ServiceId = override ?? guess.service;
  const canContinue = goal.trim().length > 0 || attachments.some((a) => a.text.trim() || a.kind === "link");
  const lowConfidence = !shouldAutoProceed(guess) && goal.trim().length > 0;

  const start = async () => {
    if (!canContinue) return;
    const task = newTask(chosen, {
      goal: goal.trim(),
      attachments,
      title: goal.trim().slice(0, 60) || SERVICES[chosen].label,
    });
    await saveTask(task);
    router.push(`/${chosen}?task=${task.id}&run=1`);
  };

  const loadExample = (ex: (typeof EXAMPLES)[number]) => {
    setGoal(ex.goal);
    setOverride(ex.service);
    setDemoExample(true);
    setAttachments(
      ex.sample
        ? [{ id: `demo_${ex.service}`, kind: "text", label: "Demo example", text: ex.sample }]
        : []
    );
    textareaRef.current?.focus();
  };

  return (
    <div className="rounded-card border border-line bg-canvas p-5 shadow-card sm:p-6">
      <Textarea
        ref={textareaRef}
        aria-label="What are you working on?"
        className="min-h-[96px] border-0 bg-transparent px-0 text-lead focus-visible:ring-0"
        placeholder="Say what you need in one sentence — e.g. “Draft a follow-up email from this thread.”"
        value={goal}
        onChange={(e) => {
          setGoal(e.target.value);
          setDemoExample(false);
        }}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") start();
        }}
      />

      {attachments.length > 0 && (
        <ul className="mb-3 mt-1 flex flex-wrap gap-2">
          {attachments.map((a) => (
            <li key={a.id} className="inline-flex items-center gap-1.5 rounded-chip border border-line bg-surface px-2 py-1 text-meta text-ink/80">
              {demoExample && a.label === "Demo example" ? "Demo example" : a.label}
              <button onClick={() => setAttachments(attachments.filter((x) => x.id !== a.id))} aria-label={`Remove ${a.label}`} className="text-muted hover:text-ink">
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
        <AttachmentAdder attachments={attachments} onChange={setAttachments} compact />
        <Button onClick={start} disabled={!canContinue} size="md">
          Continue <ArrowRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Inferred intent — a quiet line, never a form */}
      {canContinue && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <span className="inline-flex items-center gap-1.5 text-ink/75">
            <Check className="h-3.5 w-3.5 text-success" />
            {override ? "You chose" : guess.reason}
          </span>
          <span className="inline-flex items-center gap-1 rounded-chip border border-line bg-surface px-2 py-0.5 font-medium text-ink">
            <ServiceIcon name={SERVICES[chosen].icon} className="h-3.5 w-3.5" />
            {SERVICES[chosen].label}
          </span>
          {lowConfidence && !override && (
            <span className="flex flex-wrap items-center gap-1.5 text-muted">
              or
              {guess.alternatives.map((alt) => (
                <button
                  key={alt}
                  onClick={() => setOverride(alt)}
                  className="rounded-chip border border-line px-2 py-0.5 font-medium text-ink hover:bg-ink/[0.05]"
                >
                  {SERVICES[alt].label}
                </button>
              ))}
            </span>
          )}
          {override && (
            <button onClick={() => setOverride(null)} className="text-meta text-muted underline underline-offset-2 hover:text-ink">
              use suggestion
            </button>
          )}
        </div>
      )}

      {/* Examples */}
      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-3">
        <span className="inline-flex items-center gap-1 text-meta text-muted">
          <Sparkle className="h-3.5 w-3.5" /> Try an example
        </span>
        {EXAMPLES.map((ex) => (
          <button
            key={ex.label}
            onClick={() => loadExample(ex)}
            className={cn(
              "rounded-chip border border-line bg-surface px-2.5 py-1 text-meta font-medium text-ink/80 hover:bg-ink/[0.05]"
            )}
          >
            {ex.label}
          </button>
        ))}
      </div>
    </div>
  );
}

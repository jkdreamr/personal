import { NextRequest } from "next/server";
import { z } from "zod";
import { isDemoMode } from "@/lib/env";
import { SERVICES, type ServiceId } from "@/lib/services";
import { runTask } from "@/lib/ai/task-runner";
import { ProviderError } from "@/lib/ai/openrouter-client";
import { retrieveSources } from "@/lib/research/crawl-domain";
import { pastedTextSource } from "@/lib/research/source-normalizer";
import { getSearchAdapter } from "@/lib/research/search-adapter";
import { COVERAGE_DISCLOSURE } from "@/lib/research/citation-builder";
import type { Attachment, Source, Stage } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const attachmentSchema = z.object({
  id: z.string(),
  kind: z.enum(["text", "file", "link"]),
  label: z.string(),
  mime: z.string().optional(),
  text: z.string().default(""),
  meta: z.record(z.unknown()).optional(),
});

const bodySchema = z.object({
  service: z.string(),
  goal: z.string().default(""),
  attachments: z.array(attachmentSchema).default([]),
  adjustments: z
    .object({
      tone: z.string().optional(),
      length: z.string().optional(),
      style: z.string().optional(),
      confidence: z.string().optional(),
      audience: z.string().optional(),
      instruction: z.string().optional(),
      criteria: z.string().optional(),
      useVoiceProfile: z.boolean().optional(),
    })
    .default({}),
  voiceProfile: z.any().optional(),
});

function ndjson(obj: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(obj) + "\n");
}

const STAGE_LABELS: Record<Stage["id"], string> = {
  received: "Context received",
  understanding: "Understanding your material",
  sources: "Checking sources",
  drafting: "Creating your draft",
  ready: "Ready for review",
};

export async function POST(req: NextRequest) {
  let parsed: z.infer<typeof bodySchema>;
  try {
    parsed = bodySchema.parse(await req.json());
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request." }), {
      status: 400,
      headers: { "content-type": "application/json", "cache-control": "no-store" },
    });
  }

  const service = SERVICES[parsed.service as ServiceId];
  if (!service) {
    return new Response(JSON.stringify({ error: "Unknown service." }), {
      status: 404,
      headers: { "content-type": "application/json", "cache-control": "no-store" },
    });
  }

  const demo = isDemoMode();
  const attachments = parsed.attachments as Attachment[];
  const signal = req.signal;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const sentStages: Stage["id"][] = [];
      const emitStage = (id: Stage["id"], state: Stage["state"]) => {
        controller.enqueue(ndjson({ type: "stage", stage: { id, label: STAGE_LABELS[id], state } }));
      };
      const completeUpTo = (id: Stage["id"]) => {
        if (!sentStages.includes(id)) sentStages.push(id);
        emitStage(id, "done");
      };

      try {
        emitStage("received", "done");
        emitStage("understanding", "active");

        // --- Source retrieval (live mode only; demo stays offline + deterministic) ---
        let sources: Source[] = [];
        const linkUrls = attachments.filter((a) => a.kind === "link" && a.meta?.url).map((a) => String(a.meta!.url));
        const usesResearch = service.capabilities.usesResearch;

        // Pasted/file text always becomes user-provided sources for the evidence panel
        // when the service is evidence-oriented.
        if (service.capabilities.producesClaims || service.capabilities.producesComparison) {
          for (const a of attachments) {
            if ((a.kind === "text" || a.kind === "file") && a.text.trim()) {
              sources.push(pastedTextSource(a.label, a.text));
            }
          }
        }

        if (!demo && usesResearch) {
          // Seed URLs: user-provided links if any; otherwise search the web for the question.
          let seedUrls = [...linkUrls];
          let searched = false;
          if (seedUrls.length === 0 && parsed.goal.trim()) {
            const adapter = getSearchAdapter();
            if (adapter.enabled) {
              completeUpTo("understanding");
              emitStage("sources", "active");
              try {
                const hits = await adapter.search(parsed.goal, signal);
                seedUrls = hits.slice(0, 6).map((h) => h.url);
                searched = true;
              } catch {
                /* search unavailable — fall through with no seeds */
              }
            }
          }

          if (seedUrls.length > 0) {
            completeUpTo("understanding");
            emitStage("sources", "active");
            try {
              // One link → same-domain crawl; many (e.g. search results) → fetch each.
              const result = await retrieveSources(seedUrls, signal);
              sources = [...sources, ...result.sources];
              controller.enqueue(ndjson({ type: "sources", sources: result.sources, log: result.log, coverage: COVERAGE_DISCLOSURE }));
            } catch {
              controller.enqueue(ndjson({ type: "notice", message: "Some pages could not be read. Continuing with what Harbor has." }));
            }
            completeUpTo("sources");
          } else {
            if (searched)
              controller.enqueue(ndjson({ type: "notice", message: "Web search returned nothing usable just now. Add a link or paste text for a stronger result." }));
            completeUpTo("understanding");
          }
        } else {
          completeUpTo("understanding");
        }

        if (signal.aborted) {
          controller.enqueue(ndjson({ type: "cancelled" }));
          controller.close();
          return;
        }

        emitStage("drafting", "active");
        const { artifact, modelUsed } = await runTask(
          {
            service: service.id,
            goal: parsed.goal,
            attachments,
            sources,
            adjustments: parsed.adjustments,
            voiceProfile: parsed.adjustments.useVoiceProfile ? parsed.voiceProfile : null,
            signal,
          },
          demo
        );
        completeUpTo("drafting");

        emitStage("ready", "done");
        controller.enqueue(ndjson({ type: "result", artifact, modelUsed }));
        controller.close();
      } catch (err) {
        if (signal.aborted) {
          controller.enqueue(ndjson({ type: "cancelled" }));
          controller.close();
          return;
        }
        const message =
          err instanceof ProviderError
            ? "Harbor could not complete this task right now because the free research model is temporarily unavailable. Your work is still saved here."
            : "Something went wrong while creating this. Your work is still saved here — you can try again.";
        controller.enqueue(ndjson({ type: "error", message }));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-store",
      "x-accel-buffering": "no",
    },
  });
}

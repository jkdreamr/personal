import { NextRequest } from "next/server";
import { z } from "zod";
import { isDemoMode } from "@/lib/env";
import { chatCompleteStream, ProviderError } from "@/lib/ai/openrouter-client";
import { MODELS } from "@/lib/ai/model-router";
import { recordCall } from "@/lib/ai/instrumentation";
import { buildComposeMessages } from "@/lib/ai/compose-prompts";
import { composeDemo } from "@/lib/ai/demo-compose";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  mode: z.enum(["write", "continue", "improve"]),
  goal: z.string().max(2000).optional(),
  context: z.string().max(40000).optional(),
  currentText: z.string().max(40000).optional(),
  selection: z.string().max(8000).optional(),
  instruction: z.string().max(400).optional(),
  tone: z.string().max(40).optional(),
  length: z.string().max(40).optional(),
});

function ndjson(obj: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(obj) + "\n");
}

export async function POST(req: NextRequest) {
  let body: z.infer<typeof schema>;
  try {
    body = schema.parse(await req.json());
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request." }), { status: 400, headers: { "content-type": "application/json", "cache-control": "no-store" } });
  }

  const demo = isDemoMode();
  const signal = req.signal;
  // "continue" and short "improve" use the fast model for low latency; full "write" uses Owl.
  const model = body.mode === "write" ? MODELS.primary : MODELS.fast;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        if (demo) {
          for (const chunk of composeDemo(body)) {
            if (signal.aborted) break;
            controller.enqueue(ndjson({ type: "delta", text: chunk }));
          }
          controller.enqueue(ndjson({ type: "done" }));
          controller.close();
          return;
        }

        let tokens = 0;
        const text = await chatCompleteStream(
          {
            model,
            messages: buildComposeMessages(body),
            temperature: body.mode === "improve" ? 0.3 : 0.5,
            maxTokens: body.mode === "write" ? 2000 : 400,
            signal,
            onUsage: (n) => (tokens = n),
          },
          (delta) => controller.enqueue(ndjson({ type: "delta", text: delta }))
        );
        recordCall({ taskType: `compose:${body.mode}`, model, calls: 1, success: true, rateLimited: false, tokens: tokens || undefined });
        void text;
        controller.enqueue(ndjson({ type: "done" }));
        controller.close();
      } catch (err) {
        if (signal.aborted) {
          controller.enqueue(ndjson({ type: "done" }));
          controller.close();
          return;
        }
        recordCall({ taskType: `compose:${body.mode}`, model, calls: 1, success: false, rateLimited: err instanceof ProviderError && err.status === 429, errorStatus: err instanceof ProviderError ? err.status : undefined });
        const message =
          err instanceof ProviderError
            ? "Harbor couldn't reach the writing model just now. Your text is safe — try again."
            : "Something went wrong. Your text is safe — try again.";
        controller.enqueue(ndjson({ type: "error", message }));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store", "x-accel-buffering": "no" },
  });
}

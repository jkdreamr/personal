import { NextRequest } from "next/server";
import { z } from "zod";
import { isDemoMode, serverEnv } from "@/lib/env";
import { chatCompleteStream, ProviderError } from "@/lib/ai/openrouter-client";
import { MODELS, fallbackChain } from "@/lib/ai/model-router";
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
  // "continue" and short "improve" prefer the fast model for low latency; full "write" prefers
  // Owl. Each degrades through the free fallback chain so a single flaky model never errors out.
  const preferred = body.mode === "write" ? MODELS.primary : MODELS.fast;
  const chain = [...fallbackChain(preferred), ...(serverEnv.mistralKey ? [MODELS.mistral] : [])];

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      if (demo) {
        for (const chunk of composeDemo(body)) {
          if (signal.aborted) break;
          controller.enqueue(ndjson({ type: "delta", text: chunk }));
        }
        controller.enqueue(ndjson({ type: "done" }));
        controller.close();
        return;
      }

      const messages = buildComposeMessages(body);
      let emitted = false; // once we've streamed any token we can't cleanly switch models
      let tokens = 0;
      let lastErr: unknown = null;

      for (const model of chain) {
        try {
          await chatCompleteStream(
            {
              model,
              messages,
              temperature: body.mode === "improve" ? 0.3 : 0.5,
              maxTokens: body.mode === "write" ? 2000 : 400,
              signal,
              onUsage: (n) => (tokens = n),
            },
            (delta) => {
              emitted = true;
              controller.enqueue(ndjson({ type: "delta", text: delta }));
            }
          );
          recordCall({ taskType: `compose:${body.mode}`, model, calls: 1, success: true, rateLimited: false, tokens: tokens || undefined });
          controller.enqueue(ndjson({ type: "done" }));
          controller.close();
          return;
        } catch (err) {
          lastErr = err;
          if (signal.aborted) {
            controller.enqueue(ndjson({ type: "done" }));
            controller.close();
            return;
          }
          // Mid-stream failure (some text already sent) or a bad key: stop, don't restart.
          if (emitted) break;
          if (err instanceof ProviderError && (err.status === 401 || err.status === 403)) break;
          // Otherwise fall through to the next free model in the chain.
        }
      }

      recordCall({
        taskType: `compose:${body.mode}`,
        model: preferred,
        calls: 1,
        success: false,
        rateLimited: lastErr instanceof ProviderError && lastErr.status === 429,
        errorStatus: lastErr instanceof ProviderError ? lastErr.status : undefined,
      });
      const message =
        lastErr instanceof ProviderError
          ? "Harbor couldn't reach the writing model just now. Your text is safe — try again."
          : "Something went wrong. Your text is safe — try again.";
      controller.enqueue(ndjson({ type: "error", message }));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store", "x-accel-buffering": "no" },
  });
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isDemoMode } from "@/lib/env";
import { retrieveSources } from "@/lib/research/crawl-domain";
import { COVERAGE_DISCLOSURE } from "@/lib/research/citation-builder";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({ urls: z.array(z.string()).min(1).max(8) });

/**
 * Standalone retrieval endpoint (server-side fetch of public pages with SSRF/robots
 * protection). The task route uses retrieveSources directly; this exists for previewing
 * what Harbor can read from a link. Disabled in demo mode to keep things offline.
 */
export async function POST(req: NextRequest) {
  if (isDemoMode()) {
    return NextResponse.json(
      { sources: [], log: [], coverage: "Demo mode does not fetch the web.", demo: true },
      { headers: { "cache-control": "no-store" } }
    );
  }

  let body: { urls: string[] };
  try {
    body = schema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Provide one to eight links." }, { status: 400 });
  }

  try {
    const result = await retrieveSources(body.urls, req.signal);
    return NextResponse.json(
      { sources: result.sources, log: result.log, coverage: COVERAGE_DISCLOSURE },
      { headers: { "cache-control": "no-store" } }
    );
  } catch {
    return NextResponse.json(
      { error: "Harbor could not read those links right now. Your work is still saved here." },
      { status: 502, headers: { "cache-control": "no-store" } }
    );
  }
}

import "server-only";
import { NextResponse } from "next/server";
import type { z } from "zod";
import { ResearchError, toResearchError } from "@/lib/research/errors";
import { OpenAIReasoningModel, OpenAIWebSearchProvider, createOpenAIClient, openAIConfigFromEnv } from "@/lib/research/openai";
import type { PipelineDeps } from "@/lib/research/pipeline";
import type { Usage } from "@/lib/schemas";
import { limiter } from "./rate-limit";
import { dailyBudgetExceeded, recordUsage } from "./usage";

/* Wraps every live route: body validation, rate limiting, budget cap,
   typed errors and usage recording. */

let depsOverride: PipelineDeps | null = null;
/** Test hook: inject fake providers. */
export function setPipelineDepsForTests(d: PipelineDeps | null) {
  depsOverride = d;
}

export function liveDeps(): PipelineDeps {
  if (depsOverride) return depsOverride;
  const cfg = openAIConfigFromEnv();
  if (!cfg)
    throw new ResearchError(
      "not_configured",
      "Live Mode is not configured: OPENAI_API_KEY is missing on the server. Demo Mode still works.",
      false,
      503,
    );
  const client = createOpenAIClient(cfg);
  return { evidence: new OpenAIWebSearchProvider(client, cfg), model: new OpenAIReasoningModel(client, cfg) };
}

export function errorResponse(err: ResearchError) {
  return NextResponse.json(
    { error: { code: err.code, message: err.message, retryable: err.retryable } },
    { status: err.status },
  );
}

function clientKey(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return fwd?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
}

export function liveRoute<S extends z.ZodType, R extends { usage?: Usage }>(opts: {
  route: string;
  bucket: "research" | "assist";
  schema: S;
  run: (body: z.infer<S>, deps: PipelineDeps) => Promise<R>;
}) {
  return async function POST(req: Request) {
    let json: unknown;
    try {
      json = await req.json();
    } catch {
      return errorResponse(new ResearchError("invalid_request", "Request body must be JSON.", false, 400));
    }
    const parsed = opts.schema.safeParse(json);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      return errorResponse(
        new ResearchError(
          "invalid_request",
          first ? `${first.path.join(".") || "request"}: ${first.message}` : "Invalid request.",
          false,
          400,
        ),
      );
    }
    const rl = limiter(opts.bucket).check(`${opts.bucket}:${clientKey(req)}`);
    if (!rl.ok) {
      const res = errorResponse(
        new ResearchError(
          "rate_limited",
          `Research limit reached for now. Try again in about ${Math.ceil(rl.retryAfterSeconds / 60)} minute(s).`,
          true,
          429,
        ),
      );
      res.headers.set("Retry-After", String(rl.retryAfterSeconds));
      return res;
    }
    if (dailyBudgetExceeded()) {
      return errorResponse(
        new ResearchError("budget_exceeded", "Today's research budget for this demo has been used.", false, 429),
      );
    }
    try {
      const deps = liveDeps();
      const result = await opts.run(parsed.data, deps);
      recordUsage(opts.route, result.usage, true);
      return NextResponse.json(result);
    } catch (err) {
      const e = toResearchError(err);
      console.error(`[${opts.route}] ${e.code}: ${e.message}`);
      return errorResponse(e);
    }
  };
}

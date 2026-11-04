"use client";

import { demoAssist, demoBrief, demoDiscover, demoFollowup, demoIdentify } from "@/lib/demo/engine";
import { demoEmailDraft } from "@/lib/drafts";
import type {
  ApiError,
  AssistContext,
  AssistResponse,
  ChatMessage,
  DiscoveryRequest,
  DiscoveryResponse,
  DraftResponse,
  FollowupResult,
  IdentifyResult,
  IdentityCandidate,
  Mode,
  ProspectBrief,
  ProspectInput,
  ResearchSource,
} from "@/lib/schemas";

/* One client interface, two implementations. Live never falls back to
   Demo: a failed live request surfaces as a ClientError. */

export class ClientError extends Error {
  constructor(readonly info: ApiError) {
    super(info.message);
  }
}

export interface ResearchClient {
  mode: Mode;
  identify(input: ProspectInput): Promise<IdentifyResult>;
  brief(args: {
    input: ProspectInput;
    candidate: IdentityCandidate;
    identityStatus: "single-match" | "selected-by-user";
    identitySources: ResearchSource[];
    shareCustomerDetails: boolean;
  }): Promise<ProspectBrief>;
  followup(brief: ProspectBrief, aspect: string): Promise<FollowupResult>;
  discover(req: DiscoveryRequest): Promise<DiscoveryResponse>;
  assist(question: string, context: AssistContext, history: ChatMessage[]): Promise<AssistResponse>;
  draft(brief: ProspectBrief, objective: "invite-consultation" | "request-information" | "follow-up", actionId?: string): Promise<DraftResponse>;
}

async function post<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
  } catch {
    throw new ClientError({ code: "network", message: "Could not reach the server. Check your connection and try again.", retryable: true });
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = (data as { error?: ApiError } | null)?.error;
    throw new ClientError(err ?? { code: "http_" + res.status, message: `Request failed (${res.status}).`, retryable: res.status >= 500 });
  }
  return data as T;
}

export const liveClient: ResearchClient = {
  mode: "live",
  identify: (input) => post("/api/research/identify", { input }),
  brief: (args) => post("/api/research/brief", args),
  followup: (brief, aspect) => post("/api/research/followup", { brief, aspect }),
  discover: (request) => post("/api/discover", { request }),
  assist: (question, context, history) => post("/api/assist", { question, context, history }),
  draft: (brief, objective, actionId) => post("/api/drafts", { brief, objective, actionId }),
};

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));
const DEMO_DELAY = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? 0 : 700;

export const demoClient: ResearchClient = {
  mode: "demo",
  identify: async (input) => (await pause(DEMO_DELAY), demoIdentify(input)),
  brief: async ({ input, candidate, identityStatus }) => (await pause(DEMO_DELAY), demoBrief(input, candidate, identityStatus)),
  followup: async (brief, aspect) => (await pause(DEMO_DELAY / 2), demoFollowup(brief, aspect)),
  discover: async (req) => (await pause(DEMO_DELAY), demoDiscover(req)),
  assist: async (q, ctx) => (await pause(DEMO_DELAY / 3), demoAssist(q, ctx)),
  draft: async (brief, objective, actionId) => (
    await pause(DEMO_DELAY / 3), demoEmailDraft(brief, objective, brief.suggestedActions.find((a) => a.id === actionId))
  ),
};

export function clientFor(mode: Mode): ResearchClient {
  return mode === "live" ? liveClient : demoClient;
}

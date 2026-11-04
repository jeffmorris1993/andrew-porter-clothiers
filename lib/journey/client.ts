"use client";

import { ClientError } from "@/lib/client/api";
import type { Mode } from "@/lib/schemas";
import { demoBrief } from "./demo";
import type { AIPreparationBrief, JourneyBriefRequest } from "./schemas";

/** Demo: labeled sample from rules. Live: real model call. Live never falls back to the sample. */
export async function requestBrief(mode: Mode, req: JourneyBriefRequest): Promise<AIPreparationBrief> {
  if (mode === "demo") {
    await new Promise((r) => setTimeout(r, 600));
    return demoBrief(req);
  }
  let res: Response;
  try {
    res = await fetch("/api/journey/brief", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(req) });
  } catch {
    throw new ClientError({ code: "network", message: "Could not reach the server.", retryable: true });
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ClientError(data?.error ?? { code: `http_${res.status}`, message: `Request failed (${res.status}).`, retryable: res.status >= 500 });
  return data as AIPreparationBrief;
}

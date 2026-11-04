import type { z } from "zod";
import type { Usage } from "@/lib/schemas";

/* ─────────────────────────────────────────────────────────────────
   Provider layer.

   EvidenceProvider  — where facts come from (today: OpenAI web_search).
   ReasoningModel    — turns gathered evidence into structured output.

   Other data sources (a CRM, a licensed directory) can be added later as
   additional EvidenceProviders without touching the pipeline or the UI.
   ───────────────────────────────────────────────────────────────── */

export interface RawCitation {
  url: string;
  title?: string;
  startIndex: number;
  endIndex: number;
}

export interface EvidenceResult {
  /** The model's research notes, exactly as returned */
  text: string;
  /** Inline url_citation annotations into `text` */
  citations: RawCitation[];
  /** Every URL the search tool reported consulting */
  consulted: { url: string; title?: string }[];
  usage: UsageDelta;
}

export interface EvidenceRequest {
  instructions: string;
  query: string;
  maxOutputTokens?: number;
  /** Optional geographic hint for the search tool */
  location?: { city?: string; region?: string; country?: string };
}

export interface EvidenceProvider {
  readonly name: string;
  gather(req: EvidenceRequest): Promise<EvidenceResult>;
}

export interface StructuredRequest<T> {
  instructions: string;
  input: string;
  schema: z.ZodType<T>;
  schemaName: string;
  maxOutputTokens?: number;
}

export interface ReasoningModel {
  readonly name: string;
  structured<T>(req: StructuredRequest<T>): Promise<{ data: T; usage: UsageDelta }>;
}

export interface UsageDelta {
  model: string;
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  webSearchCalls: number;
}

/** Accumulates usage across the calls in one pipeline run. */
export class UsageMeter {
  private started = Date.now();
  private u: Usage = {
    model: "",
    calls: 0,
    webSearchCalls: 0,
    inputTokens: 0,
    outputTokens: 0,
    reasoningTokens: 0,
    totalTokens: 0,
    durationMs: 0,
  };

  add(d: UsageDelta) {
    this.u.model = this.u.model && this.u.model !== d.model ? `${this.u.model}, ${d.model}` : d.model;
    this.u.calls += 1;
    this.u.webSearchCalls += d.webSearchCalls;
    this.u.inputTokens += d.inputTokens;
    this.u.outputTokens += d.outputTokens;
    this.u.reasoningTokens += d.reasoningTokens;
    this.u.totalTokens += d.inputTokens + d.outputTokens;
  }

  snapshot(): Usage {
    return { ...this.u, durationMs: Date.now() - this.started };
  }
}

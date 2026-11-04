import "server-only";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import type { Response } from "openai/resources/responses/responses";
import { ResearchError, toResearchError } from "./errors";
import type {
  EvidenceProvider,
  EvidenceRequest,
  EvidenceResult,
  ReasoningModel,
  StructuredRequest,
  UsageDelta,
} from "./provider";

/* OpenAI Responses API implementations of the provider interfaces. */

export interface OpenAIConfig {
  apiKey: string;
  model: string;
  reasoningEffort?: "minimal" | "low" | "medium" | "high";
  timeoutMs: number;
}

export function openAIConfigFromEnv(): OpenAIConfig | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  const effort = process.env.OPENAI_REASONING_EFFORT as OpenAIConfig["reasoningEffort"] | "none" | undefined;
  return {
    apiKey,
    model: process.env.OPENAI_MODEL || "gpt-5.4-mini",
    reasoningEffort: effort === "none" ? undefined : (effort ?? "low"),
    timeoutMs: Number(process.env.OPENAI_TIMEOUT_MS) || 90_000,
  };
}

/** The subset of the SDK we use — lets tests inject a fake client. */
export interface ResponsesClient {
  responses: { create(body: Record<string, unknown>, opts?: { timeout?: number }): Promise<Response> };
}

export function createOpenAIClient(cfg: OpenAIConfig): ResponsesClient {
  return new OpenAI({ apiKey: cfg.apiKey, maxRetries: 1, timeout: cfg.timeoutMs }) as unknown as ResponsesClient;
}

export function usageFrom(res: Response, model: string): UsageDelta {
  const webSearchCalls = (res.output ?? []).filter((o) => o.type === "web_search_call").length;
  return {
    model: res.model || model,
    inputTokens: res.usage?.input_tokens ?? 0,
    outputTokens: res.usage?.output_tokens ?? 0,
    reasoningTokens: res.usage?.output_tokens_details?.reasoning_tokens ?? 0,
    webSearchCalls,
  };
}

/** Pulls the message text, url_citation annotations and consulted sources out of a response. */
export function extractEvidence(res: Response): Omit<EvidenceResult, "usage"> {
  let text = "";
  const citations: EvidenceResult["citations"] = [];
  const consulted: EvidenceResult["consulted"] = [];

  for (const item of res.output ?? []) {
    if (item.type === "web_search_call") {
      const action = (item as { action?: { type?: string; sources?: { url?: string }[]; url?: string | null } })
        .action;
      for (const s of action?.sources ?? []) if (s?.url) consulted.push({ url: s.url });
      if (action?.type === "open_page" && action.url) consulted.push({ url: action.url });
    }
    if (item.type === "message") {
      for (const part of item.content ?? []) {
        if (part.type !== "output_text") continue;
        const offset = text.length;
        for (const a of part.annotations ?? []) {
          if (a.type === "url_citation") {
            citations.push({
              url: a.url,
              title: a.title,
              startIndex: a.start_index + offset,
              endIndex: a.end_index + offset,
            });
          }
        }
        text += part.text;
      }
    }
  }
  return { text, citations, consulted };
}

export class OpenAIWebSearchProvider implements EvidenceProvider {
  readonly name = "openai-web-search";
  constructor(
    private client: ResponsesClient,
    private cfg: OpenAIConfig,
  ) {}

  async gather(req: EvidenceRequest): Promise<EvidenceResult> {
    try {
      const res = await this.client.responses.create(
        {
          model: this.cfg.model,
          instructions: req.instructions,
          input: req.query,
          tools: [
            {
              type: "web_search",
              search_context_size: "medium",
              ...(req.location
                ? { user_location: { type: "approximate", country: "US", ...req.location } }
                : {}),
            },
          ],
          include: ["web_search_call.action.sources"],
          max_output_tokens: req.maxOutputTokens ?? 6000,
          ...(this.cfg.reasoningEffort ? { reasoning: { effort: this.cfg.reasoningEffort } } : {}),
          store: false,
        },
        { timeout: this.cfg.timeoutMs },
      );
      if (res.status === "incomplete" && !res.output_text) {
        throw new ResearchError(
          "budget_exceeded",
          "The research step ran out of its output budget before finishing. Try a narrower request.",
          true,
          502,
        );
      }
      return { ...extractEvidence(res), usage: usageFrom(res, this.cfg.model) };
    } catch (err) {
      throw toResearchError(err);
    }
  }
}

export class OpenAIReasoningModel implements ReasoningModel {
  readonly name = "openai-structured";
  constructor(
    private client: ResponsesClient,
    private cfg: OpenAIConfig,
  ) {}

  async structured<T>(req: StructuredRequest<T>): Promise<{ data: T; usage: UsageDelta }> {
    let res: Response;
    try {
      res = await this.client.responses.create(
        {
          model: this.cfg.model,
          instructions: req.instructions,
          input: req.input,
          text: { format: zodTextFormat(req.schema as never, req.schemaName) },
          max_output_tokens: req.maxOutputTokens ?? 6000,
          ...(this.cfg.reasoningEffort ? { reasoning: { effort: this.cfg.reasoningEffort } } : {}),
          store: false,
        },
        { timeout: this.cfg.timeoutMs },
      );
    } catch (err) {
      throw toResearchError(err);
    }
    const raw = res.output_text ?? collectText(res);
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new ResearchError(
        "invalid_model_output",
        res.status === "incomplete"
          ? "The analysis step ran out of its output budget. Try again or narrow the request."
          : "The model returned output that could not be read.",
        true,
        502,
      );
    }
    const check = req.schema.safeParse(parsed);
    if (!check.success) {
      throw new ResearchError("invalid_model_output", "The model's analysis did not match the expected format.", true, 502);
    }
    return { data: check.data, usage: usageFrom(res, this.cfg.model) };
  }
}

function collectText(res: Response): string {
  let t = "";
  for (const item of res.output ?? [])
    if (item.type === "message") for (const p of item.content ?? []) if (p.type === "output_text") t += p.text;
  return t;
}

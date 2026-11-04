/** Typed error surfaced to the UI. Live failures are shown as errors, never replaced with sample data. */
export class ResearchError extends Error {
  constructor(
    readonly code:
      | "not_configured"
      | "invalid_request"
      | "rate_limited"
      | "upstream_auth"
      | "upstream_rate_limited"
      | "upstream_error"
      | "network"
      | "timeout"
      | "invalid_model_output"
      | "budget_exceeded",
    message: string,
    readonly retryable: boolean,
    readonly status: number,
  ) {
    super(message);
    this.name = "ResearchError";
  }
}

export function toResearchError(err: unknown): ResearchError {
  if (err instanceof ResearchError) return err;
  const e = err as { status?: number; name?: string; message?: string; code?: string };
  const name = e?.name ?? "";
  if (name === "APIConnectionTimeoutError" || /timed? ?out/i.test(e?.message ?? ""))
    return new ResearchError("timeout", "The research request timed out. You can try again.", true, 504);
  if (name === "APIConnectionError")
    return new ResearchError(
      "network",
      "Could not reach the OpenAI API from the server. Check network access and try again.",
      true,
      502,
    );
  if (typeof e?.status === "number") {
    if (e.status === 401 || e.status === 403)
      return new ResearchError("upstream_auth", "The OpenAI API rejected the server's credentials.", false, 502);
    if (e.status === 429)
      return new ResearchError(
        "upstream_rate_limited",
        "OpenAI rate limit or quota reached. Wait a moment and try again.",
        true,
        503,
      );
    if (e.status === 400)
      return new ResearchError("upstream_error", `OpenAI rejected the request: ${e.message ?? "bad request"}`, false, 502);
    return new ResearchError("upstream_error", "The OpenAI API returned an error. Try again shortly.", true, 502);
  }
  return new ResearchError("upstream_error", "Research failed unexpectedly.", true, 500);
}

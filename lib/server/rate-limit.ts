/* In-memory sliding-window rate limiter. Per server instance — good enough
   for a demo on Vercel; swap for a shared store (e.g. Upstash) in production. */

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export class RateLimiter {
  private hits = new Map<string, number[]>();
  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  check(key: string): RateLimitResult {
    const t = this.now();
    const recent = (this.hits.get(key) ?? []).filter((h) => t - h < this.windowMs);
    if (recent.length >= this.limit) {
      this.hits.set(key, recent);
      const retry = Math.ceil((this.windowMs - (t - recent[0])) / 1000);
      return { ok: false, remaining: 0, retryAfterSeconds: Math.max(1, retry) };
    }
    recent.push(t);
    this.hits.set(key, recent);
    return { ok: true, remaining: this.limit - recent.length, retryAfterSeconds: 0 };
  }
}

const g = globalThis as unknown as { __cidLimiters?: Record<string, RateLimiter> };

/** Shared limiters by bucket. Research (web search) is the expensive bucket. */
export function limiter(bucket: "research" | "assist"): RateLimiter {
  g.__cidLimiters ??= {
    research: new RateLimiter(Number(process.env.RATE_LIMIT_RESEARCH) || 12, 10 * 60_000),
    assist: new RateLimiter(Number(process.env.RATE_LIMIT_ASSIST) || 30, 10 * 60_000),
  };
  return g.__cidLimiters[bucket];
}

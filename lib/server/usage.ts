import type { Usage } from "@/lib/schemas";

/* Usage ledger for cost monitoring. In-memory per instance; the same
   records are also returned with every response and logged to stdout
   (visible in Vercel logs) so nothing is lost when an instance recycles. */

export interface UsageRecord extends Usage {
  at: string;
  route: string;
  ok: boolean;
}

const g = globalThis as unknown as { __cidUsage?: UsageRecord[] };

export function recordUsage(route: string, usage: Usage | undefined, ok: boolean) {
  if (!usage) return;
  g.__cidUsage ??= [];
  const rec: UsageRecord = { ...usage, route, ok, at: new Date().toISOString() };
  g.__cidUsage.push(rec);
  if (g.__cidUsage.length > 500) g.__cidUsage.shift();
  console.info(
    `[usage] ${route} model=${usage.model} calls=${usage.calls} web_search=${usage.webSearchCalls} in=${usage.inputTokens} out=${usage.outputTokens} reasoning=${usage.reasoningTokens} ms=${usage.durationMs}`,
  );
}

export function usageSummary() {
  const records = g.__cidUsage ?? [];
  const today = new Date().toISOString().slice(0, 10);
  const todays = records.filter((r) => r.at.startsWith(today));
  const sum = (rs: UsageRecord[], k: keyof Usage) => rs.reduce((a, r) => a + (r[k] as number), 0);
  return {
    since: records[0]?.at ?? null,
    requests: records.length,
    today: {
      requests: todays.length,
      modelCalls: sum(todays, "calls"),
      webSearchCalls: sum(todays, "webSearchCalls"),
      inputTokens: sum(todays, "inputTokens"),
      outputTokens: sum(todays, "outputTokens"),
      reasoningTokens: sum(todays, "reasoningTokens"),
    },
    recent: records.slice(-20).reverse(),
  };
}

/** Daily cap on model calls per instance, so a runaway client cannot run up costs. */
export function dailyBudgetExceeded(): boolean {
  const cap = Number(process.env.MAX_DAILY_MODEL_CALLS) || 400;
  return usageSummary().today.modelCalls >= cap;
}

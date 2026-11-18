import type { RunResult } from "./types";

/** One OpenRouter call made this session. Lives in React state only (no DB in v1). */
export type UsageRecord = {
  id: string;
  /** Epoch ms when the result arrived */
  at: number;
  result: RunResult;
};

export type UsageTotals = {
  requests: number;
  succeeded: number;
  failed: number;
  fallbacks: number;
  promptTokens: number;
  completionTokens: number;
  reasoningTokens: number;
  costUsd: number;
  /** True if any record had tokens but no cost, so the total is a lower bound */
  costIncomplete: boolean;
  /** Average over successful calls only. Fast-failing 429s would skew it down. */
  avgLatencyMs: number | null;
};

export type ModelTotals = UsageTotals & { model: string };

/**
 * The model that served (and billed) the call: OpenRouter bills the model that
 * actually answered, so fallbacks are attributed to the fallback, not the pick.
 */
export function servedModel(r: RunResult): string {
  return r.respondedModel ?? r.requestedModel;
}

export function summarize(records: UsageRecord[]): UsageTotals {
  const t: UsageTotals = {
    requests: records.length,
    succeeded: 0,
    failed: 0,
    fallbacks: 0,
    promptTokens: 0,
    completionTokens: 0,
    reasoningTokens: 0,
    costUsd: 0,
    costIncomplete: false,
    avgLatencyMs: null,
  };
  let latencySum = 0;

  for (const { result } of records) {
    if (result.ok) {
      t.succeeded++;
      latencySum += result.latencyMs;
    } else {
      t.failed++;
    }
    if (result.usedFallback) t.fallbacks++;

    // Failed calls can still have usage (e.g. truncated or unparseable output).
    const u = result.usage;
    if (u) {
      t.promptTokens += u.promptTokens;
      t.completionTokens += u.completionTokens;
      t.reasoningTokens += u.reasoningTokens;
      if (u.costUsd === null) t.costIncomplete = true;
      else t.costUsd += u.costUsd;
    }
  }

  t.avgLatencyMs = t.succeeded > 0 ? Math.round(latencySum / t.succeeded) : null;
  return t;
}

/** Totals per served model, most requests first. */
export function summarizeByModel(records: UsageRecord[]): ModelTotals[] {
  const groups = new Map<string, UsageRecord[]>();
  for (const rec of records) {
    const key = servedModel(rec.result);
    groups.set(key, [...(groups.get(key) ?? []), rec]);
  }
  return [...groups]
    .map(([model, recs]) => ({ model, ...summarize(recs) }))
    .sort((a, b) => b.requests - a.requests);
}

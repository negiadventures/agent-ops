import { MODEL_PRICING, type Run, type RunEvent, type Status } from "./types";

/** USD cost of a single event. Unknown models cost nothing rather than NaN. */
export function eventCost(e: RunEvent): number {
  if (!e.model) return 0;
  const p = MODEL_PRICING[e.model];
  if (!p) return 0;
  const inTok = e.promptTokens ?? 0;
  const outTok = e.completionTokens ?? 0;
  return (inTok / 1_000_000) * p.in + (outTok / 1_000_000) * p.out;
}

export function runCost(run: Run): number {
  return run.events.reduce((sum, e) => sum + eventCost(e), 0);
}

export function totalTokens(run: Run): { prompt: number; completion: number; total: number } {
  let prompt = 0;
  let completion = 0;
  for (const e of run.events) {
    prompt += e.promptTokens ?? 0;
    completion += e.completionTokens ?? 0;
  }
  return { prompt, completion, total: prompt + completion };
}

/**
 * Nearest-rank percentile. p is 0-100.
 * Returns 0 for an empty set rather than NaN, because these feed straight
 * into the UI and a NaN there is worse than a zero.
 */
export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const clamped = Math.min(100, Math.max(0, p));
  const rank = Math.ceil((clamped / 100) * sorted.length);
  return sorted[Math.max(0, rank - 1)];
}

export interface ToolStat {
  actor: string;
  calls: number;
  totalMs: number;
  p50: number;
  p95: number;
  failures: number;
}

/** Latency and failure rollup per tool, slowest p95 first. */
export function toolStats(runs: Run[]): ToolStat[] {
  const byActor = new Map<string, { durations: number[]; failures: number }>();

  for (const run of runs) {
    for (const e of run.events) {
      if (e.kind !== "tool_call") continue;
      const entry = byActor.get(e.actor) ?? { durations: [], failures: 0 };
      if (typeof e.durationMs === "number") entry.durations.push(e.durationMs);
      if (e.status === "fail") entry.failures += 1;
      byActor.set(e.actor, entry);
    }
  }

  return [...byActor.entries()]
    .map(([actor, v]) => ({
      actor,
      calls: v.durations.length,
      totalMs: v.durations.reduce((a, b) => a + b, 0),
      p50: percentile(v.durations, 50),
      p95: percentile(v.durations, 95),
      failures: v.failures,
    }))
    .sort((a, b) => b.p95 - a.p95);
}

export interface Fleet {
  runs: number;
  succeeded: number;
  failed: number;
  needsApproval: number;
  successRate: number;
  cost: number;
  tokens: number;
  /** Mean wall-clock duration across runs, ms. */
  meanDurationMs: number;
}

export function fleetSummary(runs: Run[]): Fleet {
  const succeeded = runs.filter((r) => r.status === "succeeded").length;
  const failed = runs.filter((r) => r.status === "failed").length;
  const needsApproval = runs.filter((r) => r.status === "needs_approval").length;
  const durations = runs.map(runDuration);

  return {
    runs: runs.length,
    succeeded,
    failed,
    needsApproval,
    // Only completed runs count toward the rate; in-flight ones are not failures.
    successRate: succeeded + failed === 0 ? 0 : succeeded / (succeeded + failed),
    cost: runs.reduce((s, r) => s + runCost(r), 0),
    tokens: runs.reduce((s, r) => s + totalTokens(r).total, 0),
    meanDurationMs: durations.length
      ? durations.reduce((a, b) => a + b, 0) / durations.length
      : 0,
  };
}

export function runDuration(run: Run): number {
  if (run.events.length === 0) return 0;
  const last = run.events[run.events.length - 1];
  return last.t + (last.durationMs ?? 0);
}

/** Worst status present, used to colour a run in the list. */
export function worstStatus(events: RunEvent[]): Status {
  if (events.some((e) => e.status === "fail")) return "fail";
  if (events.some((e) => e.status === "warn")) return "warn";
  if (events.some((e) => e.status === "pending")) return "pending";
  return "ok";
}

export function formatCost(usd: number): string {
  if (usd === 0) return "$0.00";
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(2)}`;
}

export function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

export function formatMs(ms: number): string {
  if (ms >= 60_000) return `${(ms / 60_000).toFixed(1)}m`;
  if (ms >= 1_000) return `${(ms / 1_000).toFixed(1)}s`;
  return `${Math.round(ms)}ms`;
}

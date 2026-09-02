import { describe, expect, it } from "vitest";
import {
  eventCost,
  fleetSummary,
  formatCost,
  formatMs,
  formatTokens,
  percentile,
  runCost,
  runDuration,
  toolStats,
  totalTokens,
  worstStatus,
} from "../lib/metrics";
import type { Run, RunEvent } from "../lib/types";

const ev = (o: Partial<RunEvent> = {}): RunEvent => ({
  t: 0,
  kind: "tool_call",
  status: "ok",
  label: "step",
  actor: "fs.read",
  ...o,
});

const run = (o: Partial<Run> = {}): Run => ({
  id: "r1",
  task: "task",
  repo: "acme/api",
  branch: "main",
  startedAt: "2026-09-01T00:00:00Z",
  status: "succeeded",
  events: [],
  filesTouched: [],
  ...o,
});

describe("cost", () => {
  it("prices prompt and completion tokens separately", () => {
    // gpt-4o: $2.50/1M in, $10/1M out
    const c = eventCost(ev({ model: "gpt-4o", promptTokens: 1_000_000, completionTokens: 1_000_000 }));
    expect(c).toBeCloseTo(12.5, 6);
  });

  it("is zero without a model, and for models we do not price", () => {
    expect(eventCost(ev({ promptTokens: 999_999 }))).toBe(0);
    expect(eventCost(ev({ model: "some-new-model", promptTokens: 1_000_000 }))).toBe(0);
  });

  it("treats missing token counts as zero rather than NaN", () => {
    const c = eventCost(ev({ model: "gpt-4o" }));
    expect(c).toBe(0);
    expect(Number.isNaN(c)).toBe(false);
  });

  it("sums across a run", () => {
    const r = run({
      events: [
        ev({ model: "gpt-4o-mini", promptTokens: 1_000_000 }),   // $0.15
        ev({ model: "gpt-4o-mini", completionTokens: 1_000_000 }), // $0.60
      ],
    });
    expect(runCost(r)).toBeCloseTo(0.75, 6);
  });
});

describe("tokens", () => {
  it("splits prompt and completion, and totals them", () => {
    const r = run({
      events: [
        ev({ promptTokens: 100, completionTokens: 20 }),
        ev({ promptTokens: 50 }),
        ev({}),
      ],
    });
    expect(totalTokens(r)).toEqual({ prompt: 150, completion: 20, total: 170 });
  });
});

describe("percentile", () => {
  it("returns 0 for an empty set instead of NaN", () => {
    expect(percentile([], 95)).toBe(0);
  });

  it("uses nearest-rank", () => {
    const v = [10, 20, 30, 40, 50];
    expect(percentile(v, 50)).toBe(30);
    expect(percentile(v, 100)).toBe(50);
    expect(percentile(v, 20)).toBe(10);
  });

  it("does not mutate the input", () => {
    const v = [3, 1, 2];
    percentile(v, 50);
    expect(v).toEqual([3, 1, 2]);
  });

  it("clamps out-of-range p", () => {
    expect(percentile([1, 2, 3], -10)).toBe(1);
    expect(percentile([1, 2, 3], 500)).toBe(3);
  });
});

describe("toolStats", () => {
  it("rolls up per tool and sorts by p95 descending", () => {
    const r = run({
      events: [
        ev({ actor: "fs.read", durationMs: 10 }),
        ev({ actor: "fs.read", durationMs: 20 }),
        ev({ actor: "db.query", durationMs: 900 }),
        ev({ actor: "db.query", durationMs: 1000, status: "fail" }),
      ],
    });
    const stats = toolStats([r]);
    expect(stats[0].actor).toBe("db.query");
    expect(stats[0].calls).toBe(2);
    expect(stats[0].failures).toBe(1);
    expect(stats[1].actor).toBe("fs.read");
    expect(stats[1].totalMs).toBe(30);
  });

  it("ignores non-tool events", () => {
    const r = run({ events: [ev({ kind: "plan", actor: "planner", durationMs: 5000 })] });
    expect(toolStats([r])).toHaveLength(0);
  });
});

describe("fleetSummary", () => {
  it("excludes in-flight runs from the success rate", () => {
    const f = fleetSummary([
      run({ status: "succeeded" }),
      run({ status: "failed" }),
      run({ status: "running" }),
      run({ status: "needs_approval" }),
    ]);
    expect(f.runs).toBe(4);
    // 1 of 2 completed, not 1 of 4
    expect(f.successRate).toBeCloseTo(0.5, 6);
    expect(f.needsApproval).toBe(1);
  });

  it("returns 0 rather than NaN when nothing has completed", () => {
    const f = fleetSummary([run({ status: "running" })]);
    expect(f.successRate).toBe(0);
    expect(Number.isNaN(f.successRate)).toBe(false);
  });

  it("handles an empty fleet", () => {
    const f = fleetSummary([]);
    expect(f).toMatchObject({ runs: 0, successRate: 0, cost: 0, tokens: 0, meanDurationMs: 0 });
  });
});

describe("runDuration", () => {
  it("includes the final event's own duration", () => {
    const r = run({ events: [ev({ t: 0, durationMs: 100 }), ev({ t: 500, durationMs: 250 })] });
    expect(runDuration(r)).toBe(750);
  });

  it("is 0 for a run with no events", () => {
    expect(runDuration(run())).toBe(0);
  });
});

describe("worstStatus", () => {
  it("ranks fail above warn above pending above ok", () => {
    expect(worstStatus([ev({ status: "ok" }), ev({ status: "warn" }), ev({ status: "fail" })])).toBe("fail");
    expect(worstStatus([ev({ status: "ok" }), ev({ status: "warn" })])).toBe("warn");
    expect(worstStatus([ev({ status: "ok" }), ev({ status: "pending" })])).toBe("pending");
    expect(worstStatus([ev({ status: "ok" })])).toBe("ok");
  });
});

describe("formatting", () => {
  it("keeps sub-cent costs legible", () => {
    expect(formatCost(0)).toBe("$0.00");
    expect(formatCost(0.0042)).toBe("$0.0042");
    expect(formatCost(1.5)).toBe("$1.50");
  });

  it("abbreviates tokens", () => {
    expect(formatTokens(999)).toBe("999");
    expect(formatTokens(1500)).toBe("1.5k");
    expect(formatTokens(2_400_000)).toBe("2.4M");
  });

  it("scales duration units", () => {
    expect(formatMs(250)).toBe("250ms");
    expect(formatMs(1500)).toBe("1.5s");
    expect(formatMs(90_000)).toBe("1.5m");
  });
});

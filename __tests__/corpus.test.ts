import { describe, expect, it } from "vitest";
import runs from "../data/runs.json";
import { fleetSummary, runCost, runDuration, toolStats } from "../lib/metrics";
import type { Run } from "../lib/types";

const data = runs as Run[];

describe("seed corpus", () => {
  it("covers every run status, so the dashboard shows all its states", () => {
    const statuses = new Set(data.map((r) => r.status));
    expect(statuses).toContain("succeeded");
    expect(statuses).toContain("failed");
    expect(statuses).toContain("needs_approval");
    expect(statuses).toContain("running");
  });

  it("has monotonically increasing event timestamps within each run", () => {
    for (const r of data) {
      const ts = r.events.map((e) => e.t);
      expect(ts).toEqual([...ts].sort((a, b) => a - b));
    }
  });

  it("produces non-trivial cost and duration", () => {
    const f = fleetSummary(data);
    expect(f.cost).toBeGreaterThan(0);
    expect(f.tokens).toBeGreaterThan(0);
    expect(f.meanDurationMs).toBeGreaterThan(0);
    for (const r of data) {
      expect(runDuration(r)).toBeGreaterThan(0);
      expect(runCost(r)).toBeGreaterThanOrEqual(0);
    }
  });

  it("spans multiple repos and tools", () => {
    expect(new Set(data.map((r) => r.repo)).size).toBeGreaterThan(2);
    expect(toolStats(data).length).toBeGreaterThan(3);
  });

  it("every event carries a label and a known status", () => {
    for (const r of data) {
      for (const e of r.events) {
        expect(e.label.length).toBeGreaterThan(0);
        expect(["ok", "warn", "fail", "pending"]).toContain(e.status);
      }
    }
  });
});

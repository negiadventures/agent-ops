import { describe, expect, it } from "vitest";
import { diffLines } from "../components/PatchDiff";

const kinds = (rows: ReturnType<typeof diffLines>) => rows.map((r) => r.kind).join("");

describe("diffLines", () => {
  it("marks identical input as all same", () => {
    expect(kinds(diffLines("a\nb\nc", "a\nb\nc"))).toBe("samesamesame");
  });

  it("detects a pure insertion and keeps surrounding context", () => {
    const rows = diffLines("a\nc", "a\nb\nc");
    expect(kinds(rows)).toBe("sameaddsame");
    expect(rows.find((r) => r.kind === "add")?.text).toBe("b");
  });

  it("detects a pure deletion", () => {
    const rows = diffLines("a\nb\nc", "a\nc");
    expect(kinds(rows)).toBe("samedelsame");
    expect(rows.find((r) => r.kind === "del")?.text).toBe("b");
  });

  it("represents a modified line as a delete plus an add", () => {
    const rows = diffLines("a\nOLD\nc", "a\nNEW\nc");
    expect(rows.filter((r) => r.kind === "del")[0].text).toBe("OLD");
    expect(rows.filter((r) => r.kind === "add")[0].text).toBe("NEW");
    expect(rows.filter((r) => r.kind === "same")).toHaveLength(2);
  });

  it("handles an empty side", () => {
    expect(kinds(diffLines("", "a\nb"))).toContain("add");
    expect(kinds(diffLines("a\nb", ""))).toContain("del");
  });

  it("keeps every original line accounted for", () => {
    const before = "one\ntwo\nthree\nfour";
    const after = "one\ntwo-changed\nthree\nfour\nfive";
    const rows = diffLines(before, after);
    const reconstructedBefore = rows.filter((r) => r.kind !== "add").map((r) => r.text).join("\n");
    const reconstructedAfter = rows.filter((r) => r.kind !== "del").map((r) => r.text).join("\n");
    expect(reconstructedBefore).toBe(before);
    expect(reconstructedAfter).toBe(after);
  });

  it("finds the minimal edit rather than replacing everything", () => {
    const before = Array.from({ length: 20 }, (_, i) => `line ${i}`).join("\n");
    const after = before.replace("line 10", "line 10 // changed");
    const rows = diffLines(before, after);
    // 19 untouched lines, one swapped
    expect(rows.filter((r) => r.kind === "same")).toHaveLength(19);
    expect(rows.filter((r) => r.kind === "add")).toHaveLength(1);
    expect(rows.filter((r) => r.kind === "del")).toHaveLength(1);
  });
});

"use client";

import { useMemo } from "react";

type Row = { kind: "same" | "add" | "del"; text: string };

/**
 * Minimal line diff (longest common subsequence).
 *
 * MagicUI's code-comparison would do this with syntax highlighting, but it
 * pulls in shiki and radix for a single before/after panel. The patches here
 * are short and we control them, so a dependency-free diff keeps the bundle
 * small and the render deterministic.
 */
export function diffLines(before: string, after: string): Row[] {
  const a = before.split("\n");
  const b = after.split("\n");

  // LCS table
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const rows: Row[] = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (a[i] === b[j]) {
      rows.push({ kind: "same", text: a[i] });
      i++; j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      rows.push({ kind: "del", text: a[i] });
      i++;
    } else {
      rows.push({ kind: "add", text: b[j] });
      j++;
    }
  }
  while (i < m) rows.push({ kind: "del", text: a[i++] });
  while (j < n) rows.push({ kind: "add", text: b[j++] });
  return rows;
}

export default function PatchDiff({
  file,
  before,
  after,
}: {
  file: string;
  before: string;
  after: string;
}) {
  const rows = useMemo(() => diffLines(before, after), [before, after]);
  const added = rows.filter((r) => r.kind === "add").length;
  const removed = rows.filter((r) => r.kind === "del").length;

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-panel">
      <div className="flex items-center justify-between border-b border-line px-5 py-3">
        <p className="font-mono text-[11px] text-muted">{file}</p>
        <p className="font-mono text-[10px] tabular-nums">
          <span className="text-ok">+{added}</span>{" "}
          <span className="text-fail">−{removed}</span>
        </p>
      </div>
      <div className="scroll-thin max-h-[300px] overflow-auto">
        <pre className="font-mono text-[11.5px] leading-[1.7]">
          {rows.map((r, i) => (
            <div
              key={i}
              className={
                r.kind === "add"
                  ? "bg-ok/10 text-ok"
                  : r.kind === "del"
                    ? "bg-fail/10 text-fail"
                    : "text-dim"
              }
            >
              <span className="inline-block w-7 shrink-0 pl-3 text-dim select-none">
                {r.kind === "add" ? "+" : r.kind === "del" ? "−" : " "}
              </span>
              <span className="whitespace-pre">{r.text || " "}</span>
            </div>
          ))}
        </pre>
      </div>
    </div>
  );
}

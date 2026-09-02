"use client";

import { useEffect, useRef } from "react";
import type { EventKind, RunEvent, Status } from "@/lib/types";
import { formatMs } from "@/lib/metrics";

const STATUS_DOT: Record<Status, string> = {
  ok: "bg-ok",
  warn: "bg-warn",
  fail: "bg-fail",
  pending: "bg-info",
};

const KIND_LABEL: Record<EventKind, string> = {
  plan: "PLAN",
  tool_call: "TOOL",
  gate: "GATE",
  approval: "HOLD",
  test: "TEST",
  patch: "PATCH",
  error: "ERROR",
  retry: "RETRY",
  done: "DONE",
};

const KIND_TONE: Record<EventKind, string> = {
  plan: "text-info",
  tool_call: "text-dim",
  gate: "text-ok",
  approval: "text-warn",
  test: "text-muted",
  patch: "text-info",
  error: "text-fail",
  retry: "text-warn",
  done: "text-muted",
};

export default function EventStream({
  events,
  visibleCount,
}: {
  events: RunEvent[];
  visibleCount: number;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const shown = events.slice(0, visibleCount);

  // Follow the tail while replaying, the way a log viewer does.
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [visibleCount]);

  return (
    <div
      ref={boxRef}
      className="scroll-thin h-[420px] overflow-y-auto rounded-xl border border-line bg-panel"
    >
      {shown.length === 0 ? (
        <p className="p-6 font-mono text-[12px] text-dim">Waiting for events…</p>
      ) : (
        <ul>
          {shown.map((e, i) => (
            <li
              key={i}
              className={`flex items-start gap-3 px-4 py-2.5 font-mono text-[12px] ${
                i > 0 ? "border-t border-line/60" : ""
              } ${i === shown.length - 1 ? "bg-white/[0.02]" : ""}`}
            >
              <span className="w-14 shrink-0 text-right text-dim tabular-nums">
                {formatMs(e.t)}
              </span>
              <span
                aria-hidden
                className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_DOT[e.status]}`}
              />
              <span className={`w-12 shrink-0 ${KIND_TONE[e.kind]}`}>
                {KIND_LABEL[e.kind]}
              </span>
              <span className="min-w-0 flex-1 break-words text-muted">
                {e.label}
                {e.detail && <span className="text-dim"> · {e.detail}</span>}
              </span>
              {typeof e.durationMs === "number" && (
                <span className="shrink-0 text-dim tabular-nums">
                  {formatMs(e.durationMs)}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

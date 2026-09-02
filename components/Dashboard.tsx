"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import CountUp from "@/components/CountUp";
import EventStream from "@/components/EventStream";
import FlowDiagram from "@/components/FlowDiagram";
import Header from "@/components/Header";
import PatchDiff from "@/components/PatchDiff";
import { BorderBeam } from "@/components/ui/border-beam";
import { DotPattern } from "@/components/ui/dot-pattern";
import {
  fleetSummary,
  formatCost,
  formatMs,
  formatTokens,
  runCost,
  runDuration,
  toolStats,
  totalTokens,
} from "@/lib/metrics";
import type { Run } from "@/lib/types";
import ContactCard from "@/components/ContactCard";
import { cn } from "@/lib/utils";

const STATUS_STYLE: Record<Run["status"], string> = {
  succeeded: "text-ok border-ok/30 bg-ok/10",
  failed: "text-fail border-fail/30 bg-fail/10",
  needs_approval: "text-warn border-warn/30 bg-warn/10",
  running: "text-info border-info/30 bg-info/10",
};

const SPEEDS = [1, 4, 16] as const;

export default function Dashboard({ runs }: { runs: Run[] }) {
  const [selectedId, setSelectedId] = useState(runs[0]?.id ?? "");
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(4);
  const [elapsed, setElapsed] = useState(0);
  const raf = useRef<number | null>(null);
  const last = useRef<number>(0);

  const run = useMemo(
    () => runs.find((r) => r.id === selectedId) ?? runs[0],
    [runs, selectedId]
  );

  const duration = run ? runDuration(run) : 0;

  // Replay clock. Drives which events are visible, so the panel reads as a
  // live run rather than a static log dump.
  useEffect(() => {
    if (!playing || !run) return;
    last.current = performance.now();

    const tick = (now: number) => {
      const dt = now - last.current;
      last.current = now;
      setElapsed((e) => {
        const next = e + dt * speed;
        return next >= duration ? duration : next;
      });
      raf.current = requestAnimationFrame(tick);
    };

    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current !== null) cancelAnimationFrame(raf.current);
    };
  }, [playing, speed, duration, run]);

  // Restart the clock when the selected run changes.
  useEffect(() => {
    setElapsed(0);
    setPlaying(true);
  }, [selectedId]);

  // Stop at the end rather than spinning rAF forever.
  useEffect(() => {
    if (duration > 0 && elapsed >= duration) setPlaying(false);
  }, [elapsed, duration]);

  const visibleCount = useMemo(
    () => (run ? run.events.filter((e) => e.t <= elapsed).length : 0),
    [run, elapsed]
  );

  const current = run?.events[Math.max(0, visibleCount - 1)];
  const fleet = useMemo(() => fleetSummary(runs), [runs]);
  const tools = useMemo(() => toolStats(runs), [runs]);

  // Budget burn is a real ratio, not a decorative number.
  const BUDGET_USD = 5;
  const spend = fleet.cost;
  const burnPct = Math.min(100, Math.round((spend / BUDGET_USD) * 100));

  if (!run) return null;

  const tok = totalTokens(run);
  const progress = duration ? Math.min(100, (elapsed / duration) * 100) : 0;

  return (
    <main className="relative min-h-screen">
      <DotPattern
        width={26} height={26} cx={1} cy={1} cr={1}
        className={cn(
          "pointer-events-none absolute inset-0 fill-white/[0.07]",
          "[mask-image:radial-gradient(60rem_circle_at_50%_0%,white,transparent)]"
        )}
      />

      <Header />

      <div className="relative mx-auto max-w-7xl px-6 py-10">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-mono text-[11px] tracking-[0.16em] text-dim uppercase">
              Agent observability
            </p>
            <h1 className="mt-2 text-[26px] font-semibold tracking-[-0.02em]">
              Replay what your agents actually did
            </h1>
          </div>
          <div className="max-w-[46ch]">
            <p className="text-[13px] leading-relaxed text-muted">
              Replay of {runs.length} coding-agent runs: tool latency, token spend,
              policy gates and the approvals that stopped a patch.
            </p>
            {/* Said plainly and up front. A demo that admits it is a demo costs
                nothing; one that quietly is not costs credibility. */}
            <p className="mt-2.5 inline-flex items-center gap-2 rounded-full border border-warn/30 bg-warn/10 px-3 py-1">
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-warn" />
              <span className="font-mono text-[10.5px] tracking-wide text-warn uppercase">
                Demo · simulated data
              </span>
            </p>
          </div>
        </header>

        {/* Fleet summary */}
        <section className="relative mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line md:grid-cols-5">
          {[
            { label: "Runs", node: <CountUp value={fleet.runs} /> },
            { label: "Success rate", node: <><CountUp value={Math.round(fleet.successRate * 100)} />%</> },
            { label: "Spend", node: formatCost(fleet.cost) },
            { label: "Tokens", node: formatTokens(fleet.tokens) },
            { label: "Mean run", node: formatMs(fleet.meanDurationMs) },
          ].map((s) => (
            <div key={s.label} className="bg-panel px-5 py-4">
              <span className="block font-mono text-[24px] leading-none font-semibold text-fg tabular-nums">
                {s.node}
              </span>
              <span className="mt-1.5 block text-[11px] text-dim">{s.label}</span>
            </div>
          ))}
          <BorderBeam size={120} duration={10} colorFrom="#7c9eff" colorTo="#3ddc97" />
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-[19rem_minmax(0,1fr)]">
          {/* Run list */}
          <aside className="min-w-0">
            <p className="font-mono text-[11px] tracking-[0.14em] text-dim uppercase">Runs</p>
            <ul className="scroll-thin mt-3 max-h-[620px] space-y-1.5 overflow-y-auto pr-1">
              {runs.map((r) => {
                const on = r.id === selectedId;
                return (
                  <li key={r.id}>
                    <button
                      onClick={() => setSelectedId(r.id)}
                      aria-current={on}
                      className={cn(
                        "w-full rounded-xl border px-3.5 py-3 text-left transition-colors",
                        on ? "border-line-2 bg-panel-2" : "border-line bg-panel hover:border-line-2"
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[10px] text-dim">{r.repo}</span>
                        <span
                          className={cn(
                            "rounded-full border px-1.5 py-0.5 font-mono text-[9px] tracking-wide uppercase",
                            STATUS_STYLE[r.status]
                          )}
                        >
                          {r.status.replace("_", " ")}
                        </span>
                      </div>
                      <p className="mt-1.5 line-clamp-2 text-[13px] leading-snug text-fg">
                        {r.task}
                      </p>
                      <p className="mt-1.5 font-mono text-[10px] text-dim tabular-nums">
                        {formatMs(runDuration(r))} · {formatCost(runCost(r))} ·{" "}
                        {r.events.length} events
                      </p>
                    </button>
                  </li>
                );
              })}
            </ul>
          </aside>

          {/* Detail */}
          <section className="min-w-0 space-y-5">
            <div className="rounded-2xl border border-line bg-panel p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="text-[16px] font-semibold tracking-tight">{run.task}</h2>
                  <p className="mt-1 font-mono text-[11px] text-dim">
                    {run.repo} · {run.branch}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      if (elapsed >= duration) setElapsed(0);
                      setPlaying((p) => !p);
                    }}
                    className="rounded-lg border border-line-2 px-3 py-1.5 font-mono text-[11px] transition-colors hover:bg-panel-2"
                  >
                    {playing ? "❚❚ pause" : elapsed >= duration ? "↻ replay" : "▶ play"}
                  </button>
                  {SPEEDS.map((s) => (
                    <button
                      key={s}
                      onClick={() => setSpeed(s)}
                      aria-pressed={speed === s}
                      className={cn(
                        "rounded-lg border px-2.5 py-1.5 font-mono text-[11px] transition-colors",
                        speed === s
                          ? "border-info bg-info/10 text-info"
                          : "border-line text-dim hover:text-fg"
                      )}
                    >
                      {s}×
                    </button>
                  ))}
                </div>
              </div>

              {/* Scrub bar */}
              <div className="mt-4">
                <div className="h-1 w-full overflow-hidden rounded-full bg-line">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-info to-ok transition-[width] duration-100"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="mt-1.5 flex justify-between font-mono text-[10px] text-dim tabular-nums">
                  <span>{formatMs(elapsed)}</span>
                  <span>
                    {visibleCount}/{run.events.length} events · {formatCost(runCost(run))} ·{" "}
                    {formatTokens(tok.total)} tok
                  </span>
                  <span>{formatMs(duration)}</span>
                </div>
              </div>
            </div>

            <FlowDiagram current={current} />

            <EventStream events={run.events} visibleCount={visibleCount} />

            {run.patch && (
              <PatchDiff
                file={run.patch.file}
                before={run.patch.before}
                after={run.patch.after}
              />
            )}

            {/* Tool latency */}
            <div className="overflow-hidden rounded-2xl border border-line bg-panel">
              <div className="flex items-center justify-between border-b border-line px-5 py-3">
                <p className="font-mono text-[11px] tracking-[0.14em] text-dim uppercase">
                  Tool latency
                </p>
                <p className="font-mono text-[10px] text-dim">across all {runs.length} runs</p>
              </div>
              <table className="w-full text-left font-mono text-[12px]">
                <thead>
                  <tr className="text-dim">
                    <th className="px-5 py-2 font-normal">tool</th>
                    <th className="px-3 py-2 text-right font-normal">calls</th>
                    <th className="px-3 py-2 text-right font-normal">p50</th>
                    <th className="px-3 py-2 text-right font-normal">p95</th>
                    <th className="px-5 py-2 text-right font-normal">fails</th>
                  </tr>
                </thead>
                <tbody>
                  {tools.map((s) => {
                    const worst = tools[0]?.p95 || 1;
                    return (
                      <tr key={s.actor} className="border-t border-line/60">
                        <td className="px-5 py-2.5">
                          <span className="text-fg">{s.actor}</span>
                          <span
                            aria-hidden
                            className="mt-1 block h-0.5 rounded-full bg-info/50"
                            style={{ width: `${Math.max(4, (s.p95 / worst) * 100)}%` }}
                          />
                        </td>
                        <td className="px-3 py-2.5 text-right text-muted tabular-nums">{s.calls}</td>
                        <td className="px-3 py-2.5 text-right text-muted tabular-nums">{formatMs(s.p50)}</td>
                        <td className="px-3 py-2.5 text-right text-fg tabular-nums">{formatMs(s.p95)}</td>
                        <td
                          className={cn(
                            "px-5 py-2.5 text-right tabular-nums",
                            s.failures > 0 ? "text-fail" : "text-dim"
                          )}
                        >
                          {s.failures}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Budget */}
            <div className="flex items-center gap-6 rounded-2xl border border-line bg-panel p-5">
              <div className="min-w-0">
                <p className="font-mono text-[11px] tracking-[0.14em] text-dim uppercase">
                  Daily budget
                </p>
                <p className="mt-2 text-[13px] leading-relaxed text-muted">
                  {formatCost(spend)} of {formatCost(BUDGET_USD)} spent across{" "}
                  {formatTokens(fleet.tokens)} tokens.{" "}
                  {burnPct >= 80 ? (
                    <span className="text-warn">Burn rate is high for the window.</span>
                  ) : (
                    <span className="text-dim">Within budget.</span>
                  )}
                </p>
              </div>
              <div className="ml-auto shrink-0">
                <div className="relative grid h-20 w-20 place-items-center">
                  <svg viewBox="0 0 36 36" className="h-20 w-20 -rotate-90">
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--color-line)" strokeWidth="3" />
                    <circle
                      cx="18" cy="18" r="15.9" fill="none"
                      stroke={burnPct >= 80 ? "var(--color-warn)" : "var(--color-ok)"}
                      strokeWidth="3" strokeLinecap="round"
                      strokeDasharray={`${burnPct} ${100 - burnPct}`}
                    />
                  </svg>
                  <span className="absolute font-mono text-[13px] font-semibold tabular-nums">
                    {burnPct}%
                  </span>
                </div>
              </div>
            </div>
          </section>
        </div>

        <footer className="mt-10 border-t border-line pt-6">
          <p className="max-w-[80ch] text-[12.5px] leading-relaxed text-dim">
            <strong className="font-semibold text-muted">This dashboard replays a
            generated corpus.</strong>{" "}
            The interface, replay engine, percentile and cost maths and the diff
            renderer are all real and tested; the runs they display are synthetic,
            not captured from a live agent runtime. The{" "}
            <code className="text-muted">Run</code> and{" "}
            <code className="text-muted">RunEvent</code> shapes map closely onto
            OpenTelemetry spans, so pointing it at real traces is a data-source
            change rather than a rewrite.
          </p>
        </footer>
      </div>

      <ContactCard
        title="Want this kind of visibility over your own agents?"
        container="max-w-7xl"
        pitch="The dashboard is a demo, but the work behind it isn't: tracing agent runs, attributing cost, and putting approval gates where they actually matter. If you're building something similar and want a hand, tell me what you're working on."
      />
    </main>
  );
}

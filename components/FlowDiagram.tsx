"use client";

import { forwardRef, useRef } from "react";
import { AnimatedBeam } from "@/components/ui/animated-beam";
import type { RunEvent } from "@/lib/types";
import { cn } from "@/lib/utils";

const Node = forwardRef<
  HTMLDivElement,
  { children: React.ReactNode; className?: string; active?: boolean }
>(({ children, className, active }, ref) => (
  <div
    ref={ref}
    className={cn(
      "z-10 grid h-11 w-11 place-items-center rounded-xl border bg-panel text-[10px] font-medium transition-colors duration-300",
      active ? "border-info text-fg shadow-[0_0_18px_-2px_rgba(124,158,255,.55)]" : "border-line text-dim",
      className
    )}
  >
    {children}
  </div>
));
Node.displayName = "Node";

/**
 * Agent → tools → gates → repo. The node under the current event lights up,
 * so the beams read as the run actually moving through the system rather than
 * as decoration.
 */
export default function FlowDiagram({ current }: { current?: RunEvent }) {
  const container = useRef<HTMLDivElement>(null);
  const agent = useRef<HTMLDivElement>(null);
  const tools = useRef<HTMLDivElement>(null);
  const gate = useRef<HTMLDivElement>(null);
  const repo = useRef<HTMLDivElement>(null);

  const kind = current?.kind;
  const activeTools = kind === "tool_call" || kind === "error" || kind === "retry";
  const activeGate = kind === "gate" || kind === "approval";
  const activeRepo = kind === "patch" || kind === "done" || kind === "test";
  const activeAgent = kind === "plan" || (!activeTools && !activeGate && !activeRepo);

  return (
    <div
      ref={container}
      className="relative flex h-[120px] items-center justify-between overflow-hidden rounded-xl border border-line bg-panel px-8"
    >
      <Node ref={agent} active={activeAgent}>agent</Node>
      <Node ref={tools} active={activeTools}>tools</Node>
      <Node ref={gate} active={activeGate}>gates</Node>
      <Node ref={repo} active={activeRepo}>repo</Node>

      <AnimatedBeam containerRef={container} fromRef={agent} toRef={tools} duration={3} curvature={-18} />
      <AnimatedBeam containerRef={container} fromRef={tools} toRef={gate} duration={3} delay={0.4} curvature={18} />
      <AnimatedBeam containerRef={container} fromRef={gate} toRef={repo} duration={3} delay={0.8} curvature={-18} />

      <span className="absolute bottom-2 left-1/2 -translate-x-1/2 font-mono text-[10px] tracking-wide text-dim uppercase">
        {current ? `${current.actor} · ${current.kind}` : "idle"}
      </span>
    </div>
  );
}

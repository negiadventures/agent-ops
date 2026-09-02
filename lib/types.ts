export type EventKind =
  | "plan"
  | "tool_call"
  | "gate"
  | "approval"
  | "test"
  | "patch"
  | "error"
  | "retry"
  | "done";

export type Status = "ok" | "warn" | "fail" | "pending";

export interface RunEvent {
  /** Milliseconds from the start of the run. */
  t: number;
  kind: EventKind;
  status: Status;
  label: string;
  /** Tool or subsystem the event belongs to, e.g. "fs.read", "schema.gate". */
  actor: string;
  /** Wall-clock duration of this step, ms. */
  durationMs?: number;
  promptTokens?: number;
  completionTokens?: number;
  /** Model used, when the step involved inference. */
  model?: string;
  detail?: string;
}

export interface Run {
  id: string;
  task: string;
  repo: string;
  branch: string;
  startedAt: string;
  status: "succeeded" | "failed" | "needs_approval" | "running";
  events: RunEvent[];
  filesTouched: string[];
  patch?: { before: string; after: string; file: string };
}

/** Per-1M-token pricing, USD. Kept in one place so cost maths is testable. */
export const MODEL_PRICING: Record<string, { in: number; out: number }> = {
  "gpt-4o": { in: 2.5, out: 10 },
  "gpt-4o-mini": { in: 0.15, out: 0.6 },
  "claude-sonnet": { in: 3, out: 15 },
  "claude-haiku": { in: 0.8, out: 4 },
};

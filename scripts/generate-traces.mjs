/**
 * Build-time seed generator.
 *
 * Runs ONCE locally, writes data/runs.json, and is never called at runtime.
 * A showcase must not hit OpenAI per visitor: it would spend the owner's
 * budget, require a server, and add a failure mode to a demo. So the model is
 * used here only to invent realistic task descriptions, file paths and error
 * strings; all timing, token and cost numbers are generated deterministically
 * below so the metrics stay internally consistent and reproducible.
 *
 *   OPENAI_KEY=... node scripts/generate-traces.mjs
 *
 * With no key it falls back to a built-in corpus, so `npm run seed` always works.
 */
import { writeFileSync, mkdirSync } from "node:fs";

const KEY = process.env.OPENAI_KEY || process.env.OPENAI_API_KEY;
const N_RUNS = 14;

const FALLBACK_TASKS = [
  { task: "Add idempotency keys to POST /charges", repo: "acme/payments-api", files: ["src/charges/handler.ts", "contracts/openapi.yaml", "migrations/0042_idempotency.sql", "tests/charges.spec.ts"] },
  { task: "Backfill null customer_email rows before the NOT NULL constraint", repo: "acme/payments-api", files: ["migrations/0043_backfill.sql", "scripts/backfill.ts"] },
  { task: "Cache the pricing table lookup in the quote endpoint", repo: "acme/quotes", files: ["src/quotes/pricing.ts", "src/cache/redis.ts", "tests/pricing.spec.ts"] },
  { task: "Migrate the webhook worker off the deprecated SDK", repo: "acme/webhooks", files: ["workers/dispatch.ts", "package.json", "tests/dispatch.spec.ts"] },
  { task: "Add retry with jitter to the ledger sync job", repo: "acme/ledger", files: ["jobs/sync.ts", "lib/retry.ts", "tests/sync.spec.ts"] },
  { task: "Split the monolith auth middleware into per-scope guards", repo: "acme/gateway", files: ["middleware/auth.ts", "middleware/scopes.ts", "tests/auth.spec.ts"] },
  { task: "Emit OpenTelemetry spans around every outbound HTTP call", repo: "acme/gateway", files: ["lib/http.ts", "lib/otel.ts"] },
  { task: "Fix the N+1 on the invoice line-items resolver", repo: "acme/billing", files: ["src/resolvers/invoice.ts", "src/loaders/lineItems.ts", "tests/invoice.spec.ts"] },
];

const TOOLS = [
  { actor: "fs.read", base: 12, spread: 30 },
  { actor: "fs.write", base: 18, spread: 40 },
  { actor: "repo.search", base: 140, spread: 320 },
  { actor: "db.query", base: 220, spread: 900 },
  { actor: "shell.exec", base: 400, spread: 2600 },
  { actor: "http.fetch", base: 180, spread: 700 },
];

// Deterministic PRNG so the same seed always yields the same corpus.
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(20260901);
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const between = (lo, hi) => Math.round(lo + rnd() * (hi - lo));

async function inventTasks() {
  if (!KEY) {
    console.log("no OPENAI_KEY, using the built-in corpus");
    return FALLBACK_TASKS;
  }
  console.log("asking the model for realistic tasks…");
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY}` },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.8,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You invent realistic backend engineering tasks for a coding agent. Reply with JSON only.",
        },
        {
          role: "user",
          content:
            'Give me {"tasks":[{"task":string,"repo":string,"files":string[]}]} with 14 entries. Tasks are concrete backend changes a coding agent would attempt (migrations, caching, retries, contracts, observability, auth). repo looks like "acme/payments-api". files are 2-5 plausible repo-relative paths. No markdown.',
        },
      ],
    }),
  });
  if (!res.ok) {
    console.warn(`  model call failed (${res.status}), falling back to the built-in corpus`);
    return FALLBACK_TASKS;
  }
  const json = await res.json();
  try {
    const parsed = JSON.parse(json.choices[0].message.content);
    const tasks = (parsed.tasks || []).filter(
      (t) => t?.task && t?.repo && Array.isArray(t.files) && t.files.length
    );
    if (tasks.length < 4) throw new Error("too few usable tasks");
    console.log(`  got ${tasks.length}`);
    return tasks;
  } catch (e) {
    console.warn("  unusable response, falling back:", e.message);
    return FALLBACK_TASKS;
  }
}

/**
 * A patch per task. Reusing one before/after across every run was the detail
 * that gave the corpus away: everything else varies, so an identical diff on
 * 14 different tasks reads as synthetic immediately.
 */
async function inventPatches(specs) {
  const fallback = (spec) => ({
    file: spec.files[0],
    before: `export async function handler(req: Request) {\n  const body = await req.json();\n  return process(body);\n}`,
    after: `export async function handler(req: Request) {\n  const body = await req.json();\n  const validated = schema.parse(body);\n  return process(validated);\n}`,
  });
  if (!KEY) return specs.map(fallback);

  console.log("asking the model for per-task patches…");
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.6,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "You write small realistic code diffs. Reply with JSON only." },
          {
            role: "user",
            content:
              'For each task give a tiny before/after code pair showing the change. Reply {"patches":[{"file":string,"before":string,"after":string}]} in the same order, one per task. 4-12 lines each, real TypeScript or SQL, "after" must differ meaningfully from "before". Use \\n for newlines. Tasks: ' +
              JSON.stringify(specs.map((s) => ({ task: s.task, file: s.files[0] }))),
          },
        ],
      }),
    });
    if (!res.ok) throw new Error(`status ${res.status}`);
    const json = await res.json();
    const parsed = JSON.parse(json.choices[0].message.content);
    const out = specs.map((s, i) => {
      const p = (parsed.patches || [])[i];
      if (!p?.before || !p?.after || p.before === p.after) return fallback(s);
      return { file: p.file || s.files[0], before: String(p.before), after: String(p.after) };
    });
    const distinct = new Set(out.map((p) => p.after)).size;
    console.log(`  got ${distinct} distinct patches for ${specs.length} tasks`);
    return out;
  } catch (e) {
    console.warn("  patch generation failed, using fallback:", e.message);
    return specs.map(fallback);
  }
}

const REPOS = ["acme/payments-api","acme/ledger","acme/gateway","acme/billing","acme/webhooks","acme/quotes"];

/**
 * Outcome plan. Probability alone collapsed to 13 successes out of 14, which
 * hides approvals and failures: the two states the dashboard exists to show.
 */
const OUTCOMES = [
  "succeeded","succeeded","needs_approval","succeeded","failed","succeeded",
  "needs_approval","succeeded","succeeded","failed","running","succeeded",
  "needs_approval","succeeded",
];

function buildRun(spec, i, patch) {
  const intended = OUTCOMES[i % OUTCOMES.length];
  const repo = /^[\w.-]+\/[\w.-]+$/.test(spec.repo || "") && i % 3 === 0 ? spec.repo : REPOS[i % REPOS.length];
  const events = [];
  let t = 0;
  const push = (e) => {
    events.push({ t, ...e });
    t += (e.durationMs ?? 0) + between(40, 220);
  };

  const model = rnd() > 0.35 ? "gpt-4o" : "gpt-4o-mini";

  push({
    kind: "plan", status: "ok", actor: "planner", model,
    label: `Planned ${spec.files.length} file changes`,
    durationMs: between(1800, 4200),
    promptTokens: between(2500, 9000), completionTokens: between(300, 1400),
  });

  for (const file of spec.files) {
    const tool = pick(TOOLS);
    push({
      kind: "tool_call", status: "ok", actor: tool.actor,
      label: `${tool.actor} ${file}`,
      durationMs: tool.base + between(0, tool.spread),
    });
  }

  const nCalls = between(4, 11);
  for (let k = 0; k < nCalls; k++) {
    const tool = pick(TOOLS);
    const slow = rnd() > 0.88;
    const failed = rnd() > 0.94;
    push({
      kind: failed ? "error" : "tool_call",
      status: failed ? "fail" : "ok",
      actor: tool.actor,
      label: failed
        ? `${tool.actor} failed: ${pick(["ETIMEDOUT after 30s", "connection reset by peer", "429 rate limited", "lock wait timeout exceeded"])}`
        : `${tool.actor} ${pick(["ok", "2 results", "cache miss", "cache hit"])}`,
      durationMs: tool.base + between(0, slow ? tool.spread * 4 : tool.spread),
    });
    if (failed) {
      push({
        kind: "retry", status: "warn", actor: tool.actor,
        label: `Retrying with backoff (attempt 2)`,
        durationMs: between(600, 2400),
      });
    }
  }

  push({
    kind: "gate", status: "ok", actor: "schema.gate",
    label: "Expand-contract verified, no destructive DDL",
    durationMs: between(120, 480),
  });
  push({
    kind: "gate", status: "ok", actor: "contract.diff",
    label: `${between(0, 2)} breaking, ${between(1, 4)} additive`,
    durationMs: between(200, 700),
  });

  const needsApproval = intended === "needs_approval";
  if (needsApproval) {
    push({
      kind: "approval", status: "pending", actor: "policy",
      label: "Write scope requires approval: migrations/",
      durationMs: between(4000, 26000),
      detail: "Path-scoped write policy",
    });
  }

  const testsFailed = intended === "failed";
  push({
    kind: "test", status: testsFailed ? "fail" : "ok", actor: "tests",
    label: testsFailed
      ? `${between(1, 4)} failing of ${between(20, 90)}, diff-scoped`
      : `${between(20, 90)} passed, diff-scoped`,
    durationMs: between(4000, 38000),
  });

  push({
    kind: "patch", status: testsFailed ? "warn" : "ok", actor: "vcs",
    label: testsFailed ? "Patch held, tests red" : `Patch applied, PR #${between(180, 320)} opened`,
    durationMs: between(300, 1200),
    model,
    promptTokens: between(6000, 24000), completionTokens: between(800, 3600),
  });

  const status = intended;
  if (status !== "running") {
    push({
      kind: "done",
      status: testsFailed ? "fail" : needsApproval ? "pending" : "ok",
      actor: "runner",
      label: `Run ${status.replace("_", " ")}`,
    });
  }

  const startedAt = new Date(Date.UTC(2026, 8, 1, 9, 0, 0) + i * between(900_000, 5_400_000)).toISOString();

  return {
    id: `run_${String(i + 1).padStart(3, "0")}`,
    task: spec.task,
    repo,
    branch: `agent/${spec.task.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 34).replace(/-$/, "")}`,
    startedAt,
    status,
    events,
    filesTouched: spec.files,
    patch,
  };
}

const specs = await inventTasks();
const patches = await inventPatches(specs);
const runs = Array.from({ length: N_RUNS }, (_, i) =>
  buildRun(specs[i % specs.length], i, patches[i % patches.length])
);

mkdirSync("data", { recursive: true });
writeFileSync("data/runs.json", JSON.stringify(runs, null, 2));

const events = runs.reduce((n, r) => n + r.events.length, 0);
console.log(`wrote data/runs.json: ${runs.length} runs, ${events} events`);
console.log(
  "  statuses:",
  JSON.stringify(
    runs.reduce((acc, r) => ({ ...acc, [r.status]: (acc[r.status] ?? 0) + 1 }), {})
  )
);

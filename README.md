# Agent Ops

A demo dashboard for coding-agent observability: tool latency, token spend,
policy gates, approvals and failures.

> **The data is simulated.** The interface, replay engine, percentile and cost
> maths and the diff renderer are real and tested. The runs they display are
> generated, not captured from a live agent runtime. `Run` and `RunEvent` map
> closely onto OpenTelemetry spans, so pointing this at real traces is a
> data-source change rather than a rewrite.

```bash
npm install
npm run dev     # http://localhost:3000
npm test        # 32 tests over the metrics and diff logic
npm run seed    # regenerate data/runs.json
```

## Why the data is baked in

The demo replays a fixed corpus rather than calling a model at runtime. A
showcase that hits an LLM per visitor spends the owner's budget, needs a server,
and adds a failure mode to the one thing that has to work. `npm run seed` uses
`OPENAI_KEY` **once** to invent realistic task titles and file paths; every
timing, token and cost figure is generated deterministically so the metrics stay
internally consistent. Without a key it falls back to a built-in corpus.

## What is actually tested

`lib/metrics.ts` holds the logic worth getting right:

- per-model token pricing, with unknown models costing 0 rather than NaN
- nearest-rank percentiles that return 0 on an empty set
- success rate that excludes in-flight runs from the denominator
- per-tool p50/p95 latency rollups
- an LCS line diff that reconstructs both sides exactly

`__tests__/corpus.test.ts` also asserts the seed data covers every run status,
so the dashboard can never ship showing only green.

## Stack

Next.js 16, React 19, Tailwind 4, MagicUI, Vitest. No backend.

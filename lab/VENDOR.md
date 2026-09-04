# /lab scratch (Hono worker spike, not linked in tabs)

- `worker.mjs`: esbuild bundle (esm, min) of `hono@4.13.5` + app source
  (`Hono`, `fire` from `hono/service-worker`; 20KB self-contained).
  Rebuild: `npx esbuild worker-src.js --bundle --format=esm --minify`.
- Scope `/lab/` on purpose: the MSW worker owns `/` and same-scope
  registration would evict it. Verified coexisting in one profile.
- Proven: shared worker heap across tabs (click in A → both show 1;
  click in B → both show 2), snapshot-on-subscribe for late joiners,
  `data-init` stream open, indicator liveness dot.

## demo-hono.html + demo-worker.mjs (live-editable routes)

- Same scope, second worker file: default POST route + fixed stream route,
  `{type:'set-route'}` message protocol (compile in worker, ack to page),
  runtime throws fan out an error patch + HTTP 500.
- Default route source lives in the page (`#default-handler` text block) —
  single source of truth, worker starts empty.
- Proven live: edit +1→+5 applies without reload; syntax breaks go red
  while the old route keeps serving; `throw` surfaces visibly in-page.
- Race found & fixed: Datastar defers its initial scan via `setTimeout`,
  so `data-init`'s one-shot stream fetch can lose the worker-claim race and
  404 with no retry. Streams now open from boot code *after* verified
  control, polling the snapshot text (same-action auto-cancel dedupes).
  Lesson: poll effects, never causes.

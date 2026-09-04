# /lab scratch (Hono worker spike, not linked in tabs)

- `worker.mjs`: esbuild bundle (esm, min) of `hono@4.13.5` + app source
  (`Hono`, `fire` from `hono/service-worker`; 20KB self-contained).
  Rebuild: `npx esbuild worker-src.js --bundle --format=esm --minify`.
- Scope `/lab/` on purpose: the MSW worker owns `/` and same-scope
  registration would evict it. Verified coexisting in one profile.
- Proven: shared worker heap across tabs (click in A → both show 1;
  click in B → both show 2), snapshot-on-subscribe for late joiners,
  `data-init` stream open, indicator liveness dot.

# e2e tests (Playwright, headless)

Regression net for the worker-coexistence fixes (stale-controller 404/501s).
Static site + real browsers; no build step.

## Setup (once)

```
cd test
npm install
npx playwright install chromium
```

(Browser binaries land in the OS cache, not the repo.)

## Run

```
cd test
npm test            # headless, serves repo root on :9271 if not already up
npm run test:headed # watch it happen
```

The `webServer` block reuses an existing `:9271` server when present
(`reuseExistingServer`), so the long-running dev server is fine.

## Specs

- `hono-takeover` — seeds a conflicting `/lab/` controller, asserts the page
  heals onto `demo-worker.mjs` (≤1 reload) and Ping works.
- `hono-coexist` — shim-served tour pages (no worker) + Hono (`/lab/`) share
  one profile without interference.
- `sse-shim` — SSE page on the registry: ping, validation, drop/reconnect.
- `hono-demo` — boot, fan-out, live-edit, break-keeps-serving, throw-surfacing.

No CI wired yet — say the word and the same command runs in Actions.

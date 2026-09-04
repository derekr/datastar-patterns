# datastar-browser-kit `0.0.1` (sketch)

A browser-first kit for building Datastar + CQRS + SSE demos with no server.
This package is the SDK the [patterns site](../index.html) wishes it had:
same shapes, factored out, tested.

## Entries (pick what you use — nothing else loads)

| Entry | Contents | Pulls in |
|---|---|---|
| `.` | sse + bus + routes + element | nothing heavy, ever |
| `./http` | `createApp` (MSW-backed routes, boot gating) | `msw` (peer) |
| `./sse` | SSE builders, signals parsing, streams | nothing |
| `./bus` | cross-window bus, owner cleanup | nothing |

Later: `./sqlite` (wasm, on `open()`), `./editor` (CodeMirror bundle, on `createEditor`), `./tour` (steps orchestration — deliberately **not** in v1; experience stays implementer-side).

## Lazy contract (enforced by review + tests)

1. Importing a module performs **zero I/O, zero timers, zero workers**.
   Everything heavy hides behind `await createX()` factories.
2. The root entry must never (transitively) import heavies. `test/` asserts
   the core import graph stays clean — add heavies only under their own entry
   with dynamic `import()`.
3. Every lazy boundary reports state: loading → ready | failed. Components
   render caller-provided `slot="loading"` / `slot="error"` content plus
   `ds-ready` / `ds-error` events (see `defineShell`).

## Components

`defineShell(name, {load, render, observed})` — eager custom-element shell,
lazy guts. Props down via attributes, events up via `CustomEvent`
(`bubbles + composed`), styled via `part="stage"` + `data-state`. The shell
itself is dependency-free; the *loader* decides what lazily arrives.

## Dev

```
npm install
npm test      # node --test, zero test deps
npm run build # vite lib build (multi-entry es)
```

## Status / roadmap

- v0: http/sse/bus/routes/element + hand-written `index.d.ts`.
- Next: sqlite entry (`sql` tag + `open()`), editor entry (CM bundle +
  TS-worker wiring), `removeElements/removeSignals/executeScript` (pending
  wire-format verification against the official SDK), tour-shell factoring
  (demo repo keeps orchestration).

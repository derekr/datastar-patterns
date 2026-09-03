# Vendored @mswjs/data (real v1, pre-npm)

- Source: https://github.com/mswjs/data @ `3229cb0a552bc14f2b62df19a91f62c135e69695`
  (`chore(release): v1.1.8` — released on GitHub only, never published to npm).
- Built in /tmp via the repo's own toolchain, then esbuild-bundled to one file:
  ```
  npm i && npm run build
  printf 'export * from "./build/index.mjs";\nexport * from "./build/extensions/sync.mjs";\n' > entry-all.js
  npx esbuild entry-all.js --bundle --format=esm --minify --outfile=msw-data.bundle.mjs
  ```
- Result: `msw-data.bundle.mjs`, 51KB min, self-contained (no imports).
  Exposes `Collection`, `Query`, `Relation`, errors, and `sync()` extension.
- Schemas are OURS: hand-rolled minimal Standard Schema (~20 lines in page
  code), no zod. Upstream zod is dev-only.
- Sync caveat, verified in source (`#generateCollectionId` hashes a
  per-process construction counter): tabs must construct shared collections
  in the SAME order or ids diverge and sync silently skips. Our pages
  construct a fixed set — keep it that way.
- UI re-render: `collection.hooks.on('create'|'update'|'delete', …)` (verified
  firing in node smoke test).
- Hooks fire PRE-commit (verified: `findMany` inside a hook sees nothing).
  Render from hooks must defer a macrotask (`setTimeout(emit, 0)`) — see the
  `changed` wiring in the C4 handler tab.
- Upgrade path: when v1 hits npm, delete this dir and `npm i @mswjs/data`
  (code to the README shape; the API is identical).

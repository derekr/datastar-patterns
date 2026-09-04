// BROWSER ONLY — imports 'msw/browser' (peer dep) and requires a Service
// Worker-capable context. Never import this from core entries or node tests.
//
// Wraps a pure route table (routes.js) onto MSW with replace semantics:
// every apply resets runtime handlers first, so re-applying never stacks
// stale worker.use() registrations.
import { setupWorker, http } from 'msw/browser';
export { createRoutes } from './routes.js';

export function createApp({ routes, onUnhandledRequest = 'bypass' } = {}) {
  if (!routes) throw new TypeError('createApp needs {routes} — see routes.js');
  const worker = setupWorker();
  let started = false;
  const sync = () => {
    worker.resetHandlers();
    for (const { method, path, resolver } of routes.entries()) {
      const h = http[method.toLowerCase()];
      if (typeof h !== 'function') throw new TypeError('unsupported method: ' + method);
      worker.use(h(path, resolver));
    }
  };
  return {
    routes,
    get worker() {
      return worker;
    },
    get started() {
      return started;
    },
    // Gate ALL app init on this promise. Service Worker registration is
    // async; requests issued before it resolves bypass to the real network.
    async start(opts = {}) {
      const r = await worker.start({ onUnhandledRequest, ...opts });
      sync();
      started = true;
      return r;
    },
    use(method, path, resolver) {
      routes.add(method, path, resolver);
      if (started) sync();
    },
    reset() {
      routes.clear();
      if (started) sync();
    },
  };
}

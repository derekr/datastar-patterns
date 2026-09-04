// Cross-window message bus. BroadcastChannel where available, graceful
// degradation elsewhere. Owner-scoped subscriptions so hosts (tour steps,
// components) can subscribe and clean up without tracking handles.
//
// `receive()` is a PUBLIC test seam: simulate remote delivery deterministically
// without timing flakiness.
export function createBus(name = 'datastar-kit') {
  const handlers = {};
  let bc = null;
  try {
    bc = new BroadcastChannel(name);
  } catch {}
  const api = {
    id: 'w-' + Math.random().toString(36).slice(2, 7),
    send(msg) {
      try {
        bc && bc.postMessage({ from: api.id, ...msg });
      } catch {}
    },
    on(kind, fn, owner) {
      const rec = { fn, owner: owner || null };
      (handlers[kind] = handlers[kind] || []).push(rec);
      return () => {
        const a = handlers[kind] || [];
        const i = a.indexOf(rec);
        if (i >= 0) a.splice(i, 1);
      };
    },
    clearOwner(owner) {
      Object.keys(handlers).forEach((k) => {
        handlers[k] = handlers[k].filter((r) => r.owner !== owner);
      });
    },
    close() {
      try {
        bc && bc.close();
      } catch {}
      Object.keys(handlers).forEach((k) => {
        handlers[k] = [];
      });
    },
    receive(kind, msg) {
      (handlers[kind] || []).forEach((rec) => {
        try {
          rec.fn(msg);
        } catch (e) {
          console.warn(e);
        }
      });
    },
  };
  if (bc) {
    bc.onmessage = (ev) => {
      const m = ev.data || {};
      if (m.from === api.id) return; // never hear our own echo
      api.receive(m.kind, m);
    };
  }
  return api;
}

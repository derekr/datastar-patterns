// Pure route table with replace semantics. No network, no DOM,
// no workers — unit-testable anywhere. Hosts adapt the table onto
// their transport (fetch shim registry, test servers, …).
export function createRoutes() {
  const table = new Map();
  const key = (method, path) => method.toUpperCase() + ' ' + path;
  return {
    add(method, path, resolver) {
      if (typeof resolver !== 'function') throw new TypeError('resolver must be a function');
      table.set(key(method, path), resolver);
    },
    remove(method, path) {
      table.delete(key(method, path));
    },
    clear() {
      table.clear();
    },
    entries() {
      return [...table.entries()].map(([k, resolver]) => {
        const i = k.indexOf(' ');
        return { method: k.slice(0, i), path: k.slice(i + 1), resolver };
      });
    },
    resolve(method, path) {
      return table.get(key(method, path));
    },
  };
}

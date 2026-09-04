// Datastar SSE response builder, shaped like the official TypeScript SDK
// (@starfederation/datastar-sdk: patchElements/patchSignals/removeElements/
// removeSignals/executeScript) so knowledge transfers to real servers.
// Pure functions: no DOM, no network — fully unit-testable.
//
// Wire-format refs live in that repo. removeElements/removeSignals/
// executeScript are DELIBERATELY OMITTED until their wire format is verified
// against official source — sketched shapes would ship wrong.
export const sse = (...blocks) => blocks.join('\n\n') + '\n\n';

/** Minimal HTML escaping for element payloads. */
export const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

/**
 * datastar-patch-elements. Official shape: selector/mode optional, and
 * mode requires selector. Bare elements patch by id morph.
 */
export function patchElements(elements, { mode = null, selector = null } = {}) {
  const lines = ['event: datastar-patch-elements'];
  if (selector) {
    lines.push('data: selector ' + selector);
    if (mode) lines.push('data: mode ' + mode);
  }
  lines.push('data: elements ' + elements);
  return lines.join('\n');
}

/**
 * datastar-patch-signals. The official SDK takes a JSON STRING — enforced
 * here so misuse fails loudly instead of patching "[object Object]".
 */
export function patchSignals(json, { onlyIfMissing = false } = {}) {
  if (typeof json !== 'string') {
    throw new TypeError(
      'patchSignals expects a JSON string (official SDK shape). ' +
        'Did you mean patchSignals(JSON.stringify(obj))?'
    );
  }
  const lines = ['event: datastar-patch-signals', 'data: signals ' + json];
  // NOTE: onlyIfMissing wire format UNVERIFIED — do not rely on this line yet.
  if (onlyIfMissing) lines.push('data: onlyIfMissing true');
  return lines.join('\n');
}

/** Wrap an SSE body in a 200 text/event-stream Response. */
export const text = (body) =>
  new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });

/** Promise delay, for staged responses. */
export const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Read Datastar signals off a real Request: JSON body (POST etc.) or
 * ?datastar= query (GET). Mirrors official readSignals semantics.
 */
export async function readSignals(req) {
  try {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      const t = await req.text();
      if (t) return JSON.parse(t);
    }
  } catch {}
  try {
    const d = new URL(req.url).searchParams.get('datastar');
    return d ? JSON.parse(d) : {};
  } catch {
    return {};
  }
}

// Open-ended SSE streams (progress, ticks). Timer registry so hosts can
// close everything on teardown/navigation — same pattern as the tour shim.
const openStreams = new Set();
function closeStream(reg) {
  if (reg.closed) return;
  reg.closed = true;
  (reg.timers || []).forEach((t) => {
    clearInterval(t);
    clearTimeout(t);
  });
  try {
    reg.controller && reg.controller.close();
  } catch {}
  openStreams.delete(reg);
}
export function closeStreams() {
  [...openStreams].forEach(closeStream);
}
export function stream(setup) {
  const reg = { closed: false, timers: [], controller: null };
  const s = new ReadableStream({
    start(c) {
      reg.controller = c;
      const enc = new TextEncoder();
      const write = (txt) => {
        if (!reg.closed) {
          try {
            c.enqueue(enc.encode(txt));
          } catch {}
        }
      };
      const every = (ms, fn) => {
        const t = setInterval(() => {
          if (!reg.closed) fn();
        }, ms);
        reg.timers.push(t);
        return t;
      };
      const after = (ms, fn) => {
        const t = setTimeout(() => {
          if (!reg.closed) fn();
        }, ms);
        reg.timers.push(t);
        return t;
      };
      try {
        setup(write, { every, after, close: () => closeStream(reg) });
      } catch {
        closeStream(reg);
      }
    },
    cancel() {
      closeStream(reg);
    },
  });
  openStreams.add(reg);
  return new Response(s, { headers: { 'Content-Type': 'text/event-stream' } });
}

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  sse,
  esc,
  patchElements,
  patchSignals,
  text,
  readSignals,
  stream,
  closeStreams,
} from '../src/sse.js';

test('sse blocks are blank-line terminated', () => {
  const out = sse('event: a\ndata: 1', 'event: b\ndata: 2');
  assert.ok(out.endsWith('\n\n'));
  assert.ok(!out.includes('\r'));
});

test('patchElements id form (no selector)', () => {
  const out = patchElements('<div id="x">1</div>');
  assert.ok(out.includes('event: datastar-patch-elements'));
  assert.ok(out.includes('data: elements <div id="x">1</div>'));
  assert.ok(!out.includes('selector'));
});

test('patchElements selector + mode form', () => {
  const out = patchElements('<b>hi</b>', { selector: '#out', mode: 'inner' });
  assert.ok(out.includes('data: selector #out'));
  assert.ok(out.includes('data: mode inner'));
});

test('patchSignals takes a JSON string, rejects objects', () => {
  const out = patchSignals(JSON.stringify({ n: 1 }));
  assert.ok(out.includes('data: signals {"n":1}'));
  assert.throws(() => patchSignals({ n: 1 }), TypeError);
});

test('esc', () => {
  assert.equal(esc('<b>&'), '&lt;b>&amp;');
});

test('readSignals: GET query + POST JSON + empty', async () => {
  const g = await readSignals(
    new Request('http://x/api/s?datastar=' + encodeURIComponent(JSON.stringify({ a: 1 })))
  );
  assert.deepEqual(g, { a: 1 });
  const p = await readSignals(
    new Request('http://x/api/c', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ b: 2 }),
    })
  );
  assert.deepEqual(p, { b: 2 });
  assert.deepEqual(await readSignals(new Request('http://x/api/z')), {});
});

test('text() sets event-stream content type', async () => {
  const r = text(sse('event: a\ndata: 1'));
  assert.equal(r.status, 200);
  assert.ok(r.headers.get('content-type').includes('text/event-stream'));
  assert.ok((await r.text()).includes('event: a'));
});

test('stream() delivers chunks then closes', async () => {
  const r = stream((write, { after, close }) => {
    write(sse('event: a\ndata: 1'));
    after(10, () => {
      write(sse('event: b\ndata: 2'));
      close();
    });
  });
  const body = await r.text();
  assert.ok(body.includes('event: a') && body.includes('event: b'));
  closeStreams();
});

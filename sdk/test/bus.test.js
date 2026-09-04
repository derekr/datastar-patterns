import test from 'node:test';
import assert from 'node:assert/strict';
import { createBus } from '../src/bus.js';

test('receive() delivers deterministically (test seam)', (t) => {
  const bus = createBus('t1');
  t.after(() => bus.close());
  const seen = [];
  bus.on('inc', (m) => seen.push(m));
  bus.receive('inc', { delta: 1 });
  assert.deepEqual(seen, [{ delta: 1 }]);
});

test('owner isolation + clearOwner', (t) => {
  const bus = createBus('t2');
  t.after(() => bus.close());
  const a = [];
  const b = [];
  bus.on('x', (m) => a.push(m), 'step-a');
  bus.on('x', (m) => b.push(m), 'step-b');
  bus.receive('x', { n: 1 });
  assert.equal(a.length, 1);
  assert.equal(b.length, 1);
  bus.clearOwner('step-a');
  bus.receive('x', { n: 2 });
  assert.equal(a.length, 1);
  assert.equal(b.length, 2);
});

test('unsub function works', (t) => {
  const bus = createBus('t3');
  t.after(() => bus.close());
  let n = 0;
  const off = bus.on('x', () => n++);
  bus.receive('x', {});
  off();
  bus.receive('x', {});
  assert.equal(n, 1);
});

test('live channel share', async (t) => {
  const name = 't-live-' + Date.now();
  const { createBus: mk } = await import('../src/bus.js');
  const a = mk(name);
  const b = mk(name);
  const seenB = [];
  b.on('ping', (m) => seenB.push(m));
  const seenA = [];
  a.on('ping', (m) => seenA.push(m));
  a.send({ kind: 'ping', n: 1 });
  await new Promise((r) => setTimeout(r, 150));
  assert.equal(seenB.length, 1);
  assert.equal(seenA.length, 0); // no self-echo
  a.close();
  b.close();
});

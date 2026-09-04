import test from 'node:test';
import assert from 'node:assert/strict';
import { createRoutes } from '../src/routes.js';

test('add + resolve (case-insensitive method)', () => {
  const r = createRoutes();
  const fn = async () => new Response('x');
  r.add('post', '/api/a', fn);
  assert.equal(r.resolve('POST', '/api/a'), fn);
});

test('replace semantics: re-add overwrites', () => {
  const r = createRoutes();
  const a = async () => new Response('a');
  const b = async () => new Response('b');
  r.add('GET', '/x', a);
  r.add('GET', '/x', b);
  assert.equal(r.resolve('get', '/x'), b);
});

test('remove + clear', () => {
  const r = createRoutes();
  const fn = async () => new Response('x');
  r.add('GET', '/x', fn);
  r.remove('GET', '/x');
  assert.equal(r.resolve('GET', '/x'), undefined);
  r.add('GET', '/y', fn);
  r.clear();
  assert.deepEqual(r.entries(), []);
});

test('entries shape', () => {
  const r = createRoutes();
  const fn = async () => new Response('x');
  r.add('POST', '/api/contact', fn);
  assert.deepEqual(r.entries(), [{ method: 'POST', path: '/api/contact', resolver: fn }]);
});

test('non-function resolver throws', () => {
  const r = createRoutes();
  assert.throws(() => r.add('GET', '/x', 'nope'), TypeError);
});

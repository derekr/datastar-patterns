// Shim-served tour pages and the Hono worker (/lab/) share one profile:
// sse works with NO service worker controlling it, lab works with its own.
import { test, expect } from '@playwright/test';

test('shim pages + hono worker coexist', async ({ browser }) => {
  const ctx = await browser.newContext();
  const sse = await ctx.newPage();
  await sse.goto('/sse.html#sse-1');
  await sse.waitForTimeout(4000);

  const lab = await ctx.newPage();
  await lab.goto('/lab/demo-hono.html');
  await lab.waitForFunction(
    () => document.getElementById('routeStatus').textContent === 'route: live',
    { timeout: 25000 }
  );
  const ctl = await lab.evaluate(() => navigator.serviceWorker.controller?.scriptURL || '(none)');
  expect(ctl).toContain('demo-worker.mjs');

  // sse is worker-free (fetch shim answers in-page) and still patches
  const sseCtl = await sse.evaluate(() => navigator.serviceWorker.controller?.scriptURL || '(none)');
  expect(sseCtl).toBe('(none)');
  await sse.click('#preview button');
  await sse.waitForTimeout(1200);
  expect(await sse.textContent('#s8_out')).not.toContain('pong lands here');

  // lab fan still works alongside
  await lab.click('.demo button.btn');
  await lab.waitForTimeout(1200);
  expect(await lab.textContent('#hono_count')).not.toContain('…');
  await ctx.close();
});

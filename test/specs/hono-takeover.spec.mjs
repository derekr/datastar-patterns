// Regression test for the reported failure: a stale/conflicting worker
// controlling /lab/* while the Hono worker waits ("worker: ready
// (activating)" + 404/501s from python). The page must end up controlled
// by demo-worker.mjs with at most one healing reload.
import { test, expect } from '@playwright/test';

test('stale controller heals: ends on demo-worker, ping works', async ({ browser }) => {
  const ctx = await browser.newContext();
  const seed = await ctx.newPage();
  // Seed a conflicting controller for /lab/* (as the old spike worker did).
  // NOTE: SW scope must live under the script path, hence the fixture in lab/.
  await seed.goto('/about.html');
  await seed.evaluate(async () => {
    // NOTE: no `ready` await here — it never resolves on a page outside
    // the worker's scope. Poll the registration itself instead.
    await navigator.serviceWorker.register('/lab/__dummy-sw.js', { scope: '/lab/' });
    const deadline = Date.now() + 10000;
    for (;;) {
      const reg = await navigator.serviceWorker.getRegistration('/lab/');
      if (reg?.active?.state === 'activated') return reg.active.state;
      if (Date.now() > deadline) return 'TIMEOUT:' + (reg?.active?.state || reg?.installing?.state || 'none');
      await new Promise((r) => setTimeout(r, 200));
    }
  });
  await seed.close();

  const page = await ctx.newPage();
  let navs = 0;
  page.on('framenavigated', () => navs++);
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)));
  await page.goto('/lab/demo-hono.html');
  await page.waitForFunction(
    () => document.getElementById('routeStatus').textContent === 'route: live',
    { timeout: 25000 }
  );
  const ctl = await page.evaluate(() => navigator.serviceWorker.controller?.scriptURL || '(none)');
  expect(ctl).toContain('demo-worker.mjs');
  expect(navs).toBeLessThanOrEqual(2);

  await page.click('text=Increment (server)');
  await page.waitForFunction(
    () => document.getElementById('hono_count')?.textContent.trim() !== '…',
    { timeout: 8000 }
  );
  expect(errors).toEqual([]);
  await ctx.close();
});

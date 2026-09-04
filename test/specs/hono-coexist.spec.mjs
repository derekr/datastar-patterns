// MSW worker (/) and Hono worker (/lab/) coexist in one profile:
// each serves its own pages without evicting the other.
import { test, expect } from '@playwright/test';

test('msw + hono workers coexist', async ({ browser }) => {
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

  // sse still served by MSW path (shim-free page, worker-backed)
  await sse.click('#preview button');
  await sse.waitForTimeout(1200);
  expect(await sse.textContent('#s8_out')).not.toContain('pong lands here');

  // lab fan still works alongside
  await lab.click('text=Increment (server)');
  await lab.waitForTimeout(1200);
  expect(await lab.textContent('#hono_count')).not.toContain('…');
  await ctx.close();
});

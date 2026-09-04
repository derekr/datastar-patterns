// SSE page on the fetch-shim registry (no worker involved):
// ping patches, validation errors patch, drop/reconnect snapshot works.
import { test, expect } from '@playwright/test';

test('sse shim: ping, validate, drop, reconnect', async ({ browser }) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  await page.goto('/sse.html#sse-1');
  await page.waitForTimeout(2500);

  // worker-free by design
  expect(await page.evaluate(() => navigator.serviceWorker.controller?.scriptURL || '(none)')).toBe(
    '(none)'
  );

  // 1. ping
  await page.click('#preview button');
  await page.waitForTimeout(1200);
  expect(await page.textContent('#s8_out')).not.toContain('pong lands here');

  // 3. validation errors (step 3 has the form + submit; validate via step 2 demo)
  // NOTE: fragment-only goto() does not reload (shell routes once at load),
  // so set the hash and reload for a full boot onto the step.
  await page.goto('/sse.html#sse-2');
  await page.reload();
  await page.waitForTimeout(1500);
  const input = await page.$('#preview input[type=text]');
  await input.fill('no-at-sign');
  await page.waitForTimeout(1500);
  expect(await page.textContent('#s8_errors')).toContain('must contain @');

  // 5. drop + reconnect snapshot
  await page.goto('/sse.html#sse-5');
  await page.reload();
  await page.waitForTimeout(1500);
  // NOTE: never use text= selectors on tour pages — the editor visibly
  // renders the demo source, so button text matches twice (real button +
  // code text). Always scope to #preview with nth.
  await page.click('#preview button >> nth=0');
  await page.waitForTimeout(2500);
  await page.click('#preview button >> nth=1');
  await page.waitForTimeout(1000);
  expect(await page.textContent('#s8_conn')).toContain('disconnected');
  await page.click('#preview button >> nth=2');
  await page.waitForTimeout(1000);
  expect(await page.textContent('#s8_conn')).toContain('snapshot');
  expect(errs).toEqual([]);
  await ctx.close();
});

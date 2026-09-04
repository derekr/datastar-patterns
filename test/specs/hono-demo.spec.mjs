// demo-hono core flows: boot, increment fan-out, live-edit, break, throw.
import { test, expect } from '@playwright/test';

test('live-editable routes end to end', async ({ browser }) => {
  const ctx = await browser.newContext();
  const a = await ctx.newPage();
  const errs = [];
  a.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  await a.goto('/lab/demo-hono.html');
  await a.waitForFunction(
    () => document.getElementById('routeStatus').textContent === 'route: live',
    { timeout: 25000 }
  );
  const b = await ctx.newPage();
  await b.goto('/lab/demo-hono.html');
  await b.waitForFunction(
    () => document.getElementById('routeStatus').textContent === 'route: live',
    { timeout: 25000 }
  );
  await b.waitForTimeout(1200); // B snapshot lands
  const count = (p) => p.textContent('#hono_count');

  await a.click('.demo button.btn');
  await a.waitForTimeout(1000);
  expect(await count(a)).toContain('1');
  expect(await count(b)).toContain('1');

  // live-edit +1 -> +5, no reload
  await a.evaluate(() => {
    const cm = window.__cm;
    cm.setValue(cm.getValue().replace('H.getCount() + 1', 'H.getCount() + 5'));
  });
  await a.click('#applyBtn');
  await a.waitForFunction(
    () => document.getElementById('routeStatus').textContent === 'route: live',
    { timeout: 8000 }
  );
  await a.click('.demo button.btn');
  await a.waitForTimeout(1000);
  expect(await count(a)).toContain('6');
  expect(await count(b)).toContain('6');

  // syntax break: red status, old route keeps serving
  await a.evaluate(() => window.__cm.setValue('this is not js((('));
  await a.click('#applyBtn');
  await expect(a.locator('#routeStatus')).toContainText('SYNTAX ERROR');
  await a.click('.demo button.btn');
  await a.waitForTimeout(1000);
  expect(await count(a)).toContain('11');

  // runtime throw: visible error patch
  await a.evaluate(() => window.__cm.setValue("throw new Error('boom')"));
  await a.click('#applyBtn');
  await a.waitForTimeout(500);
  await a.click('.demo button.btn');
  await a.waitForTimeout(1000);
  expect(await a.textContent('#hono_status')).toContain('boom');
  expect(errs).toEqual([]);
  await ctx.close();
});

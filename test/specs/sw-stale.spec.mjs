// Stale root-scope worker: banner appears, one click removes it,
// demos keep working throughout (fetch shim answers in-page first).
import { test, expect } from '@playwright/test';

test('stale worker banner heals', async ({ browser }) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));

  // seed a stale root-scope worker (as an old mock backend would leave)
  await page.goto('/index.html');
  await page.evaluate(async () => {
    await navigator.serviceWorker.register('/__sw-fixture.js', { scope: '/' });
  });
  await page.reload();
  await page.waitForTimeout(2500);

  // banner offers the fix (worker registered from a previous era)
  const banner = page.locator('#main .banner.off', { hasText: 'stale service worker' });
  await expect(banner).toBeVisible({ timeout: 15000 });

  // demo works even before the fix (shim answers before network)
  await page.goto('/index.html#tour-1');
  await page.reload();
  await page.waitForTimeout(2000);

  // one click removes + reloads; banner gone, worker gone
  await page.getByRole('button', { name: 'Remove & reload' }).click();
  await page.waitForLoadState('load');
  await page.waitForTimeout(2000);
  const regs = await page.evaluate(
    async () => (await navigator.serviceWorker.getRegistrations()).map((r) => r.scope)
  );
  expect(regs.filter((s) => s === new URL('/', location.href).href)).toEqual([]);
  // NOTE: #main always contains TourShell's empty hidden previewErr.banner —
  // assert on the stale banner's text, not the class.
  expect(await page.getByText('stale service worker').count()).toBe(0);
  expect(errs).toEqual([]);
  await ctx.close();
});

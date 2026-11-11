import { expect, test } from '@playwright/test';
import { lab, openLab, ringScroller, scrollMetrics, settle, showSurface, measure } from './lab.js';

test('the lab opens a recorded fight and the Ring shows its history', async ({ page }) => {
  const external: string[] = [];
  page.on('request', (r) => {
    if (!r.url().startsWith('http://127.0.0.1')) external.push(r.url());
  });
  await openLab(page, 'duel', { history: 60 });
  await showSurface(page, 'The Ring');
  const scroller = ringScroller(page);
  await expect(scroller).toBeVisible();
  const m = await settle(scroller);
  expect(m.rows).toBeGreaterThan(0);
  measure('smoke.open.gap', m.gap);
  await lab(page, 'push', 10);
  const after = await settle(scroller);
  expect(after.scrollHeight).toBeGreaterThan(m.scrollHeight);
  expect(external).toEqual([]);
  expect((await scrollMetrics(scroller)).rows).toBeGreaterThan(0);
});

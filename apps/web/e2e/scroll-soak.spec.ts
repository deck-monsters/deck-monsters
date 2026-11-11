import { expect, test } from '@playwright/test';
import { lab, measure } from './lab.js';
import {
  THEME_IDS,
  expectPinned,
  gesture,
  idle,
  openFeed,
  snap,
  startFrames,
  stopFrames,
  type FrameStats,
} from './scroll-helpers.js';

/*
 * Soak: the whole of `long-session` (936 events, three fights) replayed at 20x into a followed
 * Ring, then a trip to the top of the feed by gestures and back. Opt-in (`E2E_SOAK=1`): it takes
 * a couple of minutes and exists to catch what a short test cannot, namely a list that grows
 * without bound, a heap that does, or a frame that stalls once the feed is long.
 *
 *   E2E_SOAK=1 pnpm exec playwright test scroll-soak
 */

test.skip(process.env['E2E_SOAK'] !== '1', 'soak runs only with E2E_SOAK=1');

for (const theme of THEME_IDS) {
  test(`ring › soak › long-session at 20x stays pinned and smooth, then top and back [${theme}] @soak`, async ({ page }) => {
    test.slow();
    await openFeed(page, 'ring', 'long-session', { history: 0, theme });
    const heap = () =>
      page.evaluate(() => {
        const m = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
        return m ? m.usedJSHeapSize : -1;
      });

    const frames: FrameStats = { count: 0, max: 0, over50: 0, over100: 0, over500: 0 };
    const merge = (f: FrameStats) => {
      frames.count += f.count;
      frames.max = Math.max(frames.max, f.max);
      frames.over50 += f.over50;
      frames.over100 += f.over100;
      frames.over500 += f.over500;
    };
    const rows: string[] = [];
    const report = async (label: string, since: FrameStats) => {
      const s = await snap(page, 'ring');
      const h = await heap();
      rows.push(
        `${label}: nodes=${s.nodes} heapMB=${h < 0 ? 'n/a' : (h / 1e6).toFixed(1)} gap=${s.gap.toFixed(0)}px ` +
          `longestFrame=${since.max.toFixed(0)}ms scrollHeight=${s.scrollHeight}`,
      );
      return { s, h };
    };

    const heapStart = await heap();
    await startFrames(page);
    await lab(page, 'play', { speed: 20 });
    const t0 = Date.now();
    let nodesMax = 0;
    let heapMax = heapStart;
    await test.step('replay at 20x until done, reporting every 5 s', async () => {
      let nextReport = t0 + 5_000;
      while (!(await lab<boolean>(page, 'done')) && Date.now() - t0 < 240_000) {
        await page.waitForTimeout(500);
        if (Date.now() >= nextReport) {
          nextReport += 5_000;
          const since = await stopFrames(page);
          merge(since);
          await startFrames(page);
          const { s, h } = await report(`t+${Math.round((Date.now() - t0) / 1000)}s (${await lab<number>(page, 'published')} events)`, since);
          nodesMax = Math.max(nodesMax, s.nodes);
          heapMax = Math.max(heapMax, h);
        }
      }
    });
    merge(await stopFrames(page));
    measure('soak.replayWallSeconds', (Date.now() - t0) / 1000, 's');
    expect(await lab<boolean>(page, 'done'), 'the replay finished').toBe(true);

    const end = await expectPinned(page, 'ring', 'soak.end');
    const endHeap = await heap();
    measure('soak.nodesAtEnd', end.nodes, '');
    measure('soak.nodesMax', nodesMax, '');
    measure('soak.heapMBStart', heapStart / 1e6, 'MB');
    measure('soak.heapMBMax', heapMax / 1e6, 'MB');
    measure('soak.heapMBEnd', endHeap / 1e6, 'MB');
    measure('soak.scrollHeightEnd', end.scrollHeight);
    measure('soak.longestFrame', frames.max, 'ms');
    measure('soak.framesOver100', frames.over100, '');
    measure('soak.framesOver500', frames.over500, '');
    measure('soak.frames', frames.count, '');

    await test.step('to the top by gestures and back', async () => {
      await startFrames(page);
      const up0 = Date.now();
      let s = await snap(page, 'ring');
      let steps = 0;
      while (s.scrollTop > 1 && steps < 200) {
        await gesture(page, 'ring', 1_000);
        await idle(page, 'ring', 100, 1_500);
        s = await snap(page, 'ring');
        steps++;
      }
      measure('soak.upSteps', steps, '');
      measure('soak.upMs', Date.now() - up0, 'ms');
      measure('soak.topScrollTop', s.scrollTop);
      measure('soak.topNodes', s.nodes, '');
      const down0 = Date.now();
      let back = 0;
      while (s.gap > 1.5 && back < 200) {
        await gesture(page, 'ring', -1_000);
        await idle(page, 'ring', 100, 1_500);
        s = await snap(page, 'ring');
        back++;
      }
      measure('soak.downSteps', back, '');
      measure('soak.downMs', Date.now() - down0, 'ms');
      measure('soak.gapBackAtBottom', s.gap);
      const f = await stopFrames(page);
      measure('soak.travelLongestFrame', f.max, 'ms');
      measure('soak.travelFramesOver100', f.over100, '');
      merge(f);
    });

    test.info().annotations.push({ type: 'soak-log', description: rows.join(' | ') });
    for (const r of rows) console.log(`[soak ${theme} ${test.info().project.name}] ${r}`);
    expect(frames.max, 'longest animation frame over the whole soak (ms)').toBeLessThan(500);
  });
}

import { expect, test, type Page } from '@playwright/test';
import { lab, measure, openLab, showSurface } from './lab.js';
import {
  FOLLOW_GAP_PX,
  REVERSE_PX,
  ROW_DRIFT_PX,
  THEME_IDS,
  commonRows,
  counters,
  expectPinned,
  firstFullyVisible,
  gesture,
  scrollerLocator,
  gestureAndSettle,
  idle,
  installScrollLib,
  isTouchProject,
  jumpButton,
  lastRowVisible,
  longestStretchMs,
  push,
  rowByIndex,
  scrollUpBy,
  setup,
  snap,
  startSampler,
  stopSampler,
  timings,
  typeCommands,
  waitThemeLoaded,
  type Pane,
  type Snap,
  type ThemeId,
} from './scroll-helpers.js';

/*
 * Scroll invariants over the feed lab, for the Ring and the Console, on a phone and a desktop
 * viewport, on Phosphor and Millefleur. Each test is one invariant; each records the pixels it
 * measured through `measure()` so the JSON report is the baseline. A failing invariant on the
 * current app is a finding: tolerances are the app's own (gap 8 px, row drift 2 px).
 *
 * The Console only shows this viewer's PRIVATE events (the fixtures hold few that draw a row) and
 * the highlight rows (NAT 20, BIG HIT, KILL) it derives from public events: on `brawl` that is one
 * row at each of events 25, 77, 97, 100, 167, 192, 254, 325, 349, 428. So the Console is fed two ways:
 *  - typed commands (each is echoed back as one row) where the invariant is about following the
 *    reader's own input. NB `ConsolePane` forces following when you submit, by design, so these
 *    cannot show the Console failing to follow its own echo;
 *  - fixture events (history 160, then `push(8)` reaches the highlight at 167) where the reader
 *    must NOT be moved by arrivals they did not cause.
 */

const PANES: Pane[] = ['ring', 'console'];

/*
 * Theme matrix. Millefleur is a lazy stylesheet with a different feed type, so it exercises the
 * metrics, estimate and remount paths: it runs for every test where those matter (opening,
 * following bursts and resizes, reading back, the history walk, returning via ↓ Latest, theme
 * switches). The rest run on Phosphor only to keep the default suite near four minutes on two
 * workers; `E2E_ALL_THEMES=1` runs the full matrix.
 */
const ALL_THEMES = process.env['E2E_ALL_THEMES'] === '1';
type Body = (args: { page: Page }) => Promise<void>;
const testCore = (theme: ThemeId, title: string, fn: Body): void => {
  if (theme === 'phosphor' || ALL_THEMES) test(title, fn);
};

/** Deliver "some arrivals" in the way each pane can receive them. */
async function arrive(page: Page, pane: Pane, n: number): Promise<void> {
  if (pane === 'ring') await push(page, n);
  else await typeCommands(page, n, 0, 'arr');
}

/** Bring the feed to the bottom if the test's own setup left it elsewhere (recorded, not asserted). */
async function toBottom(page: Page, pane: Pane, name: string): Promise<void> {
  let s = await snap(page, pane);
  measure(`${name}.startGap`, s.gap);
  for (let k = 0; k < 40 && s.gap > 2; k++) s = await gestureAndSettle(page, pane, -400);
  await idle(page, pane, 300, 4_000);
}

/** How far the 'gap' stayed over a threshold, as a share of samples. */
function gapReport(name: string, samples: Array<{ t: number; gap: number; jump: boolean }>) {
  const n = Math.max(1, samples.length);
  const max = samples.reduce((m, s) => Math.max(m, s.gap), 0);
  const over8 = samples.filter((s) => s.gap > FOLLOW_GAP_PX).length / n;
  const over100 = samples.filter((s) => s.gap > 100).length / n;
  const stretch8 = longestStretchMs(samples, (s) => s.gap > FOLLOW_GAP_PX);
  const stretch100 = longestStretchMs(samples, (s) => s.gap > 100);
  measure(`${name}.samples`, samples.length, '');
  measure(`${name}.maxGap`, max);
  measure(`${name}.fracOver8`, over8 * 100, '%');
  measure(`${name}.fracOver100`, over100 * 100, '%');
  measure(`${name}.longestOver8`, stretch8, 'ms');
  measure(`${name}.longestOver100`, stretch100, 'ms');
  return { max, over8, over100, stretch8, stretch100 };
}

/** Switch the pane's surface away to Chat and back, by whichever control the layout has. */
async function awayTo(page: Page, pane: Pane): Promise<void> {
  if (isTouchProject()) {
    await page.getByRole('tab', { name: 'Chat', exact: true }).click();
  } else {
    const side = pane === 'ring' ? 'left' : 'right';
    await page.getByLabel(`Surface shown in the ${side} pane`).selectOption({ label: 'Chat' });
  }
}
async function backTo(page: Page, pane: Pane): Promise<void> {
  const label = pane === 'ring' ? 'The Ring' : 'Console';
  if (isTouchProject()) {
    await showSurface(page, label);
  } else {
    const side = pane === 'ring' ? 'left' : 'right';
    await page.getByLabel(`Surface shown in the ${side} pane`).selectOption({ label });
  }
}

/* ══ 1. FOLLOWING ═════════════════════════════════════════════════════════════════════ */

for (const theme of THEME_IDS) {
  for (const pane of PANES) {
    {
      test(`${pane} › following › 20 single arrivals 150 ms apart stay pinned [${theme}]`, async ({ page }) => {
        await setup(page, pane, theme);
        await toBottom(page, pane, 'a');
        await startSampler(page, pane, 50);
        await test.step('20 arrivals, 150 ms apart', async () => {
          for (let k = 0; k < 20; k++) {
            await arrive(page, pane, 1);
            await page.waitForTimeout(150);
          }
        });
        const samples = await stopSampler(page);
        gapReport('a.during', samples);
        await expectPinned(page, pane, 'a.end');
      });

      test(`${pane} › following › a burst of 25 stays pinned [${theme}]`, async ({ page }) => {
        await setup(page, pane, theme);
        await toBottom(page, pane, 'b');
        const before = await snap(page, pane);
        await test.step('25 arrivals in one tick (Console: typed back to back)', async () => {
          await arrive(page, pane, 25);
        });
        const s = await expectPinned(page, pane, 'b.end');
        measure('b.heightGrowth', s.scrollHeight - before.scrollHeight);
        expect(s.scrollHeight, 'the burst actually added rows').toBeGreaterThan(before.scrollHeight);
      });

      testCore(theme, `${pane} › following › a tab away for 2 s while events arrive, then back, is pinned [${theme}]`, async ({ page }) => {
        // Ring: public events; Console: the highlight rows at 167 and 192 (from history 160).
        await setup(page, pane, theme);
        await toBottom(page, pane, 'g');
        await test.step('switch away', () => awayTo(page, pane));
        await test.step('events arrive for 2 s', async () => {
          for (let k = 0; k < 10; k++) {
            await push(page, 3);
            await page.waitForTimeout(200);
          }
        });
        await test.step('switch back', () => backTo(page, pane));
        await page.waitForFunction(
          (p) => !!(window as unknown as { __sc: { scrollerOf(p: string): unknown } }).__sc.scrollerOf(p),
          pane,
        );
        await expectPinned(page, pane, 'g.back');
      });

      test(`${pane} › following › resizing the viewport keeps it pinned [${theme}]`, async ({ page }) => {
        await setup(page, pane, theme);
        await toBottom(page, pane, 'f');
        const touch = isTouchProject();
        const small = touch ? { width: 390, height: 500 } : { width: 1100, height: 900 };
        const big = touch ? { width: 390, height: 844 } : { width: 1440, height: 900 };
        await test.step(`resize to ${small.width}x${small.height}`, async () => {
          await page.setViewportSize(small);
          await expectPinned(page, pane, 'f.small');
        });
        await test.step('an arrival at the small size is followed', async () => {
          await arrive(page, pane, 5);
          await expectPinned(page, pane, 'f.small.arrival');
        });
        await test.step(`resize back to ${big.width}x${big.height}`, async () => {
          await page.setViewportSize(big);
          await expectPinned(page, pane, 'f.big');
        });
      });
    }
  }

  {
    testCore(theme, `ring › following › bursts with card frames stay pinned [${theme}]`, async ({ page }) => {
      // brawl events 302, 307, 326, 331, 336, 354 are card frames; 4 bursts of 10 from 300.
      await setup(page, 'ring', theme);
      await toBottom(page, 'ring', 'c');
      for (let k = 0; k < 4; k++) {
        await test.step(`burst ${k + 1} (events ${300 + k * 10}-${309 + k * 10})`, async () => {
          const before = await snap(page, 'ring');
          await push(page, 10);
          await page.waitForTimeout(200);
          const s = await expectPinned(page, 'ring', `c.burst${k + 1}`);
          measure(`c.burst${k + 1}.heightGrowth`, s.scrollHeight - before.scrollHeight);
        });
      }
    });

    testCore(theme, `ring › following › play at 8x for 10 s tracks the newest line [${theme}]`, async ({ page }) => {
      await setup(page, 'ring', theme);
      await toBottom(page, 'ring', 'd');
      await startSampler(page, 'ring', 100);
      await lab(page, 'play', { speed: 8 });
      await page.waitForTimeout(10_000);
      await lab(page, 'pause');
      const samples = await stopSampler(page);
      const r = gapReport('d.during', samples);
      measure('d.published', await lab<number>(page, 'published'), '');
      await expectPinned(page, 'ring', 'd.end');
      // A follow that lags for seconds IS the reported bug even if it catches up at the end.
      // One second without the newest line in view is already a long time at 8x.
      expect(r.stretch100, 'longest stretch with the feed more than 100 px short of the bottom (ms)').toBeLessThanOrEqual(1_000);
    });

    testCore(theme, `ring › following › the roster growing and the items panel appearing [${theme}]`, async ({ page }) => {
      await setup(page, 'ring', theme, { history: 0 });
      await toBottom(page, 'ring', 'e');
      await startSampler(page, 'ring', 50);
      let maxHeaderShift = 0;
      const rosterH = () =>
        page.evaluate(() => {
          const sc = document.querySelector<HTMLElement>('.event-feed[aria-label="Ring events"][tabindex]');
          return sc ? sc.clientHeight : 0;
        });
      const h0 = await rosterH();
      await test.step('the join sequence arrives, 3 events every 150 ms', async () => {
        for (let k = 0; k < 30; k++) {
          await push(page, 3);
          await page.waitForTimeout(150);
          maxHeaderShift = Math.max(maxHeaderShift, h0 - (await rosterH()));
        }
      });
      const samples = await stopSampler(page);
      const r = gapReport('e.during', samples);
      measure('e.viewportShrank', maxHeaderShift);
      measure('e.itemsPanelShown', (await page.getByText(/Use an item/).count()) > 0 ? 1 : 0, '');
      await expectPinned(page, 'ring', 'e.end');
      expect(r.stretch100, 'longest stretch more than 100 px short of the bottom (ms)').toBeLessThanOrEqual(1_000);
    });
  }
}

/* ══ 2. READING BACK ══════════════════════════════════════════════════════════════════ */

/**
 * Hold a reader at `tracked` while arrivals happen for `ms`; returns the worst movement of that
 * row and whether the feed was ever pulled down. Arrivals: push(30) then play at 8x.
 */
async function holdWhileArrivals(page: Page, pane: Pane, tracked: { i: number; top: number }, ms: number) {
  const start = await snap(page, pane);
  await push(page, pane === 'ring' ? 30 : 25);
  await lab(page, 'play', { speed: 8 });
  const t0 = Date.now();
  let maxDrift = 0;
  let minGapDelta = Infinity;
  let jumpAlways = true;
  let rowMissing = 0;
  let n = 0;
  while (Date.now() - t0 < ms) {
    const s = await snap(page, pane);
    n++;
    const row = rowByIndex(s, tracked.i);
    if (!row) rowMissing++;
    else maxDrift = Math.max(maxDrift, Math.abs(row.top - tracked.top));
    minGapDelta = Math.min(minGapDelta, s.gap - start.gap);
    if (!s.jump) jumpAlways = false;
    await page.waitForTimeout(100);
  }
  await lab(page, 'pause');
  const end = await snap(page, pane);
  return { start, end, maxDrift, minGapDelta, jumpAlways, rowMissing, n };
}

for (const theme of THEME_IDS) {
  for (const pane of PANES) {
    const far = pane === 'ring' ? 1_200 : 500;

    test(`${pane} › reading back › far up, arrivals leave the row where it is [${theme}]`, async ({ page }) => {
      await setup(page, pane, theme);
      await toBottom(page, pane, 'r1');
      const moved = await scrollUpBy(page, pane, far);
      measure('r1.scrolledUp', moved);
      const s0 = await snap(page, pane);
      expect(s0.jump, '↓ Latest appears once the reader is away from the bottom').toBe(true);
      const tracked = firstFullyVisible(s0);
      const r = await holdWhileArrivals(page, pane, tracked, 2_000);
      measure('r1.rowDrift', r.maxDrift);
      measure('r1.gapGrowth', r.end.gap - r.start.gap);
      measure('r1.minGapDelta', r.minGapDelta);
      measure('r1.scrollTopChange', r.end.scrollTop - r.start.scrollTop);
      expect(r.end.scrollHeight, 'arrivals actually happened (content grew)').toBeGreaterThan(r.start.scrollHeight);
      expect(r.rowMissing, 'tracked row stayed on screen').toBe(0);
      expect(r.maxDrift, 'tracked row top moved (px)').toBeLessThanOrEqual(ROW_DRIFT_PX);
      expect(r.jumpAlways, '↓ Latest stayed visible').toBe(true);
      expect(r.minGapDelta, 'gap never shrank below where the reader left it (px)').toBeGreaterThanOrEqual(-ROW_DRIFT_PX);
      expect(r.end.gap, 'following stays off: gap grew').toBeGreaterThan(r.start.gap);
    });

    test(`${pane} › reading back › two lines up (40 px), arrivals do not yank the reader [${theme}]`, async ({ page }) => {
      await setup(page, pane, theme);
      await toBottom(page, pane, 'r2');
      await gestureAndSettle(page, pane, 40);
      const s0 = await snap(page, pane);
      measure('r2.gapAfterGesture', s0.gap);
      measure('r2.jumpVisible', s0.jump ? 1 : 0, '');
      expect(s0.gap, 'the gesture moved the feed').toBeGreaterThan(FOLLOW_GAP_PX);
      const tracked = firstFullyVisible(s0);
      const r = await holdWhileArrivals(page, pane, tracked, 2_000);
      measure('r2.rowDrift', r.maxDrift);
      measure('r2.minGapDelta', r.minGapDelta);
      measure('r2.gapGrowth', r.end.gap - r.start.gap);
      expect(r.end.scrollHeight, 'arrivals actually happened (content grew)').toBeGreaterThan(r.start.scrollHeight);
      expect(r.rowMissing, 'tracked row stayed on screen').toBe(0);
      expect(r.maxDrift, 'tracked row top moved (px)').toBeLessThanOrEqual(ROW_DRIFT_PX);
      expect(r.jumpAlways, '↓ Latest stayed visible').toBe(true);
      expect(r.minGapDelta, 'the feed did not snap back down (px)').toBeGreaterThanOrEqual(-ROW_DRIFT_PX);
    });

    testCore(theme, `${pane} › reading back › idle for 3 s past the intent window, then arrivals [${theme}]`, async ({ page }) => {
      await setup(page, pane, theme);
      await toBottom(page, pane, 'r3');
      await scrollUpBy(page, pane, pane === 'ring' ? 600 : 300);
      const s0 = await snap(page, pane);
      expect(s0.jump).toBe(true);
      const tracked = firstFullyVisible(s0);
      await test.step('wait 3 s (the app\'s intent window is 1.5 s)', () => page.waitForTimeout(3_000));
      const mid = await snap(page, pane);
      const idleRow = rowByIndex(mid, tracked.i);
      measure('r3.idleDrift', idleRow ? Math.abs(idleRow.top - tracked.top) : 9_999);
      const r = await holdWhileArrivals(page, pane, tracked, 2_000);
      measure('r3.rowDrift', r.maxDrift);
      measure('r3.minGapDelta', r.minGapDelta);
      expect(r.end.scrollHeight, 'arrivals actually happened (content grew)').toBeGreaterThan(r.start.scrollHeight);
      expect(r.rowMissing, 'tracked row stayed on screen').toBe(0);
      expect(r.maxDrift, 'tracked row top moved (px)').toBeLessThanOrEqual(ROW_DRIFT_PX);
      expect(r.jumpAlways, '↓ Latest stayed visible').toBe(true);
      expect(r.minGapDelta, 'the feed did not snap back down (px)').toBeGreaterThanOrEqual(-ROW_DRIFT_PX);
    });
  }
}

/* ══ 3. SCROLLING UP THROUGH HISTORY ══════════════════════════════════════════════════ */

interface WalkResult {
  steps: number;
  travelled: number;
  reverseMax: number;
  nonMonotonic: number;
  jumps: number;
  largestJump: number;
  largestSelfJump: number;
  stepErrors: number[];
}

async function walkUp(page: Page, pane: Pane, targetPx: number, quietMs: number, maxMs: number): Promise<WalkResult> {
  const STEP = 120;
  let prev = await snap(page, pane);
  const startTop = prev.scrollTop;
  const out: WalkResult = {
    steps: 0,
    travelled: 0,
    reverseMax: 0,
    nonMonotonic: 0,
    jumps: 0,
    largestJump: 0,
    largestSelfJump: 0,
    stepErrors: [],
  };
  while (out.travelled < targetPx && out.steps < 120) {
    await gesture(page, pane, STEP);
    await idle(page, pane, quietMs, maxMs);
    const cur = await snap(page, pane);
    out.steps++;
    const scrollDelta = prev.scrollTop - cur.scrollTop; // > 0: moved up as asked
    out.travelled = startTop - cur.scrollTop;
    const reverse = cur.scrollTop - prev.scrollTop;
    out.reverseMax = Math.max(out.reverseMax, reverse);
    if (reverse > REVERSE_PX) out.nonMonotonic++;
    const hitTop = cur.scrollTop <= 1;
    for (const r of commonRows(prev, cur)) {
      const moved = r.after - r.before;
      // vs the gesture's nominal delta (skip the step that ran out of history), and vs the
      // scroller's own scrollTop change (content moving under the reader without scrolling).
      const self = Math.abs(moved - scrollDelta);
      out.largestSelfJump = Math.max(out.largestSelfJump, self);
      if (!hitTop) {
        const nominal = Math.abs(moved - STEP);
        out.largestJump = Math.max(out.largestJump, nominal);
        if (nominal > ROW_DRIFT_PX) out.jumps++;
        out.stepErrors.push(Math.round((moved - STEP) * 10) / 10);
        break; // one tracked row per step is enough; the first common row is the topmost one
      }
    }
    prev = cur;
    if (hitTop) break;
  }
  return out;
}

for (const theme of THEME_IDS) {
  for (const pane of PANES) {
    const target = pane === 'ring' ? 4_000 : 2_000;
    for (const playing of [false, true]) {
      if (playing && pane === 'console') continue; // the Console has no stream to play
      (playing || pane === 'console' ? testCore : (_t: ThemeId, title: string, fn: Body) => test(title, fn))(theme, `${pane} › history walk › 120 px steps through ${target} px${playing ? ' while playing at 4x' : ''} [${theme}]`, async ({ page }) => {
        await setup(page, pane, theme, pane === 'console' ? { seedRows: 90 } : {});
        await toBottom(page, pane, 'h');
        const publishedBefore = await lab<number>(page, 'published');
        if (playing) await lab(page, 'play', { speed: 4 });
        const w = await walkUp(page, pane, target, playing ? 80 : 100, playing ? 500 : 2_000);
        if (playing) await lab(page, 'pause');
        measure('h.eventsPublishedDuringWalk', (await lab<number>(page, 'published')) - publishedBefore, '');
        measure('h.steps', w.steps, '');
        measure('h.travelled', w.travelled);
        measure('h.reverseMax', w.reverseMax);
        measure('h.nonMonotonicSteps', w.nonMonotonic, '');
        measure('h.jumpSteps', w.jumps, '');
        measure('h.largestJump', w.largestJump);
        measure('h.largestJumpVsScrollTop', w.largestSelfJump);
        test.info().annotations.push({ type: 'measure', description: `h.stepErrors=${w.stepErrors.join(',')}` });
        expect(w.travelled, `scrolled at least ${target} px (or reached the top of the history)`).toBeGreaterThanOrEqual(
          Math.min(target, 1_000),
        );
        expect(w.reverseMax, 'scrollTop moved the opposite way between gestures (px)').toBeLessThanOrEqual(REVERSE_PX);
        expect(w.nonMonotonic, 'steps where scrollTop increased').toBe(0);
        expect(w.largestJump, 'tracked row moved by a different amount than the gesture (px)').toBeLessThanOrEqual(ROW_DRIFT_PX);
        // largestJumpVsScrollTop is reported, not asserted: Virtuoso legitimately moves scrollTop
        // to compensate for a measured height ABOVE the reader, which keeps the row where it is.
      });
    }
  }
}

/* ══ 4. RETURNING ═════════════════════════════════════════════════════════════════════ */

/** After returning, the next arrival is followed. Console: the next highlight row is event 167 (history 160). */
async function nextArrivalFollowed(page: Page, pane: Pane, name: string): Promise<void> {
  const before = await snap(page, pane);
  await push(page, pane === 'ring' ? 5 : 8);
  await page.waitForTimeout(200);
  const s = await expectPinned(page, pane, name);
  measure(`${name}.heightGrowth`, s.scrollHeight - before.scrollHeight);
  expect(s.scrollHeight, `${name}: the arrival added content`).toBeGreaterThan(before.scrollHeight);
}

for (const theme of THEME_IDS) {
  for (const pane of PANES) {
    const far = pane === 'ring' ? 1_500 : 500;

    test(`${pane} › returning › ↓ Latest lands within 2 s and following resumes [${theme}]`, async ({ page }) => {
      await setup(page, pane, theme);
      await toBottom(page, pane, 'j');
      await scrollUpBy(page, pane, far);
      const s0 = await snap(page, pane);
      expect(s0.jump).toBe(true);
      measure('j.gapBefore', s0.gap);
      const t0 = Date.now();
      await jumpButton(page, pane).click();
      let s = await snap(page, pane);
      let gapAt2s: number | null = null;
      // Keep watching past 2 s (up to 8 s) so the report says how long the landing really took.
      while (s.gap > FOLLOW_GAP_PX && Date.now() - t0 < 8_000) {
        await page.waitForTimeout(50);
        s = await snap(page, pane);
        if (gapAt2s === null && Date.now() - t0 >= 2_000) gapAt2s = s.gap;
      }
      const took = Date.now() - t0;
      measure('j.landedMs', took, 'ms');
      measure('j.gapEnd', s.gap);
      measure('j.jumpStillVisibleAtEnd', (await snap(page, pane)).jump ? 1 : 0, '');
      measure('j.gapAt2s', gapAt2s ?? s.gap);
      expect(took, 'ms from the click until the gap is within 8 px').toBeLessThanOrEqual(2_000);
      await idle(page, pane, 400, 4_000);
      const after = await snap(page, pane);
      expect(after.jump, '↓ Latest disappeared').toBe(false);
      measure('j.gapSettled', after.gap);
      await nextArrivalFollowed(page, pane, 'j.next');
    });

    // The owner's iPhone, on the plain list: `↓ Latest` landed near the end, not at it. A
    // momentum scroll keeps writing positions after the jump. No test browser has momentum, so
    // this writes those positions in script, with no input event, as a momentum frame would.
    test(`${pane} › returning › ↓ Latest holds the end against a momentum scroll [${theme}]`, async ({ page }) => {
      test.skip(process.env['E2E_FEED'] !== 'plain', 'the plain list only: the virtual list has no hold');
      await setup(page, pane, theme);
      await toBottom(page, pane, 'm');
      await scrollUpBy(page, pane, far);
      expect((await snap(page, pane)).jump).toBe(true);
      await jumpButton(page, pane).click();
      await scrollerLocator(page, pane).evaluate(async (el) => {
        // 1.2 s of overwrites, longer than any fixed hold that would feel instant.
        for (let i = 0; i < 12; i++) {
          el.scrollTop -= 40;
          await new Promise<void>((r) => setTimeout(r, 100));
        }
      });
      await idle(page, pane, 400, 4_000);
      const after = await snap(page, pane);
      measure('m.gapEnd', after.gap);
      expect(after.gap, 'gap to the bottom after the momentum frames').toBeLessThanOrEqual(1.5);
      expect(after.jump, '↓ Latest disappeared').toBe(false);
      await nextArrivalFollowed(page, pane, 'm.next');
    });

    test(`${pane} › returning › a reader's scroll right after ↓ Latest still wins [${theme}]`, async ({ page }) => {
      test.skip(process.env['E2E_FEED'] !== 'plain', 'the plain list only: the virtual list has no hold');
      await setup(page, pane, theme);
      await toBottom(page, pane, 'n');
      await scrollUpBy(page, pane, far);
      await jumpButton(page, pane).click();
      // Inside the hold: a real gesture must end it.
      await gesture(page, pane, 300);
      await idle(page, pane, 400, 4_000);
      const after = await snap(page, pane);
      measure('n.gap', after.gap);
      expect(after.gap, 'the reader moved up and stayed there').toBeGreaterThan(100);
      expect(after.jump, '↓ Latest is back').toBe(true);
    });

    testCore(theme, `${pane} › returning › scrolling back down by gestures resumes following [${theme}]`, async ({ page }) => {
      await setup(page, pane, theme);
      await toBottom(page, pane, 'k');
      await scrollUpBy(page, pane, pane === 'ring' ? 900 : 400);
      let s = await snap(page, pane);
      expect(s.jump).toBe(true);
      let steps = 0;
      while (s.gap > 1.5 && steps < 60) {
        s = await gestureAndSettle(page, pane, -120);
        steps++;
      }
      measure('k.steps', steps, '');
      measure('k.gapAtBottom', s.gap);
      await idle(page, pane, 600, 4_000);
      s = await snap(page, pane);
      measure('k.gapSettled', s.gap);
      expect(s.gap, 'reached the bottom').toBeLessThanOrEqual(FOLLOW_GAP_PX);
      expect(s.jump, '↓ Latest disappeared on reaching the bottom').toBe(false);
      await nextArrivalFollowed(page, pane, 'k.next');
    });
  }
}

/* ══ 5. KEEPING PLACE ACROSS CHANGES ══════════════════════════════════════════════════ */

for (const theme of THEME_IDS) {
  const other: ThemeId = theme === 'phosphor' ? 'millefleur' : 'phosphor';
  for (const pane of PANES) {
    const listKey = pane === 'ring' ? 'ring' : 'console';

    test(`${pane} › theme switch › ${theme} to ${other} and back while following ends at the bottom [${theme}]`, async ({ page }) => {
      await setup(page, pane, theme);
      await toBottom(page, pane, 't1');
      const c0 = await counters(page);
      for (const [n, to] of [[1, other], [2, theme]] as const) {
        await test.step(`switch to ${to}`, async () => {
          await lab(page, 'setTheme', to);
          await waitThemeLoaded(page, to);
          await expectPinned(page, pane, `t1.switch${n}`);
          const c = await counters(page);
          measure(`t1.switch${n}.listMounts`, (c[`${listKey}.list.mount`] ?? 0) - (c0[`${listKey}.list.mount`] ?? 0), '');
          measure(
            `t1.switch${n}.metricsRemounts`,
            (c[`${listKey}.list.remount.metrics`] ?? 0) - (c0[`${listKey}.list.remount.metrics`] ?? 0),
            '',
          );
        });
      }
    });

    test(`${pane} › theme switch › ${theme} to ${other} and back while reading back keeps the row on screen [${theme}]`, async ({ page }) => {
      await setup(page, pane, theme);
      await toBottom(page, pane, 't2');
      await scrollUpBy(page, pane, pane === 'ring' ? 900 : 400);
      let s = await snap(page, pane);
      expect(s.jump).toBe(true);
      const tracked = firstFullyVisible(s);
      const c0 = await counters(page);
      for (const [n, to] of [[1, other], [2, theme]] as const) {
        await test.step(`switch to ${to}`, async () => {
          await lab(page, 'setTheme', to);
          await waitThemeLoaded(page, to);
          await idle(page, pane, 600, 6_000);
          s = await snap(page, pane);
          const row = rowByIndex(s, tracked.i);
          const c = await counters(page);
          measure(`t2.switch${n}.rowMoved`, row ? row.top - tracked.top : 9_999);
          measure(`t2.switch${n}.trackedIndex`, tracked.i, '');
          measure(`t2.switch${n}.firstVisibleIndexAfter`, s.rows[0]?.i ?? -1, '');
          measure(`t2.switch${n}.gap`, s.gap);
          measure(`t2.switch${n}.listMounts`, (c[`${listKey}.list.mount`] ?? 0) - (c0[`${listKey}.list.mount`] ?? 0), '');
          measure(
            `t2.switch${n}.metricsRemounts`,
            (c[`${listKey}.list.remount.metrics`] ?? 0) - (c0[`${listKey}.list.remount.metrics`] ?? 0),
            '',
          );
          expect(row, `the row the reader was on (index ${tracked.i}) is still on screen`).toBeDefined();
          expect(s.gap, 'still reading back (not yanked to the bottom)').toBeGreaterThan(FOLLOW_GAP_PX);
          expect(s.jump, '↓ Latest still offered').toBe(true);
        });
      }
    });

    test(`${pane} › rotation › 390x844 to 844x390 and back [${theme}]`, async ({ page }) => {
      test.skip(!isTouchProject(), 'rotation is a phone behaviour');
      await setup(page, pane, theme);
      await toBottom(page, pane, 'o');
      await test.step('while following', async () => {
        await page.setViewportSize({ width: 844, height: 390 });
        await expectPinned(page, pane, 'o.follow.landscape');
        await page.setViewportSize({ width: 390, height: 844 });
        await expectPinned(page, pane, 'o.follow.portrait');
      });
      await test.step('while reading back', async () => {
        await scrollUpBy(page, pane, pane === 'ring' ? 900 : 400);
        let s = await snap(page, pane);
        const tracked = firstFullyVisible(s);
        for (const [n, vp] of [
          [1, { width: 844, height: 390 }],
          [2, { width: 390, height: 844 }],
        ] as const) {
          await page.setViewportSize(vp);
          await idle(page, pane, 600, 6_000);
          s = await snap(page, pane);
          const row = rowByIndex(s, tracked.i);
          measure(`o.read.${n}.rowMoved`, row ? row.top - tracked.top : 9_999);
          measure(`o.read.${n}.trackedIndex`, tracked.i, '');
          measure(`o.read.${n}.firstVisibleIndexAfter`, s.rows[0]?.i ?? -1, '');
          measure(`o.read.${n}.gap`, s.gap);
          expect(row, `row ${tracked.i} still on screen after rotating to ${vp.width}x${vp.height}`).toBeDefined();
          expect(s.gap, 'still reading back').toBeGreaterThan(FOLLOW_GAP_PX);
        }
      });
    });
  }
}

/* ══ 6. OPENING ═══════════════════════════════════════════════════════════════════════ */

/** rAF sampler of the Ring scroller, installed before the app runs. */
function installOpenSampler(): void {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const w = window as any;
  w.__open = { frames: [] as any[], stop: false, firstRaf: 0 };
  const loop = (t: number) => {
    if (!w.__open.firstRaf) w.__open.firstRaf = t;
    const el = document.querySelector<HTMLElement>('.event-feed[aria-label="Ring events"][tabindex]');
    if (el && el.getClientRects().length > 0 && el.clientHeight > 0) {
      const box = el.getBoundingClientRect();
      const idx: number[] = [];
      let all = 0;
      el.querySelectorAll<HTMLElement>('[data-item-index]').forEach((n) => {
        all++;
        const r = n.getBoundingClientRect();
        if (r.bottom > box.top && r.top < box.bottom) idx.push(Number(n.getAttribute('data-item-index')));
      });
      if (all > 0) {
        w.__open.frames.push({
          t,
          scrollTop: el.scrollTop,
          scrollHeight: el.scrollHeight,
          clientHeight: el.clientHeight,
          gap: el.scrollHeight - el.scrollTop - el.clientHeight,
          first: idx.length ? Math.min(...idx) : -1,
          last: idx.length ? Math.max(...idx) : -1,
        });
      }
    }
    if (!w.__open.stop) requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  // DOM states at microtask checkpoints. Not all are painted, but a state that exists here and
  // shows the oldest row proves the list passed through it, which a rAF sampler can miss.
  const record = (src: string) => {
    const el = document.querySelector<HTMLElement>('.event-feed[aria-label="Ring events"][tabindex]');
    if (!el || el.getClientRects().length === 0 || el.clientHeight <= 0) return;
    const box = el.getBoundingClientRect();
    let first = -1;
    el.querySelectorAll<HTMLElement>('[data-item-index]').forEach((n) => {
      const r = n.getBoundingClientRect();
      if (r.bottom > box.top && r.top < box.bottom) {
        const i = Number(n.getAttribute('data-item-index'));
        if (first < 0 || i < first) first = i;
      }
    });
    w.__open.dom.push({ src, t: performance.now(), scrollTop: el.scrollTop, first });
  };
  w.__open.dom = [] as any[];
  new MutationObserver(() => {
    if (!w.__open.stop) record('mut');
  }).observe(document, { subtree: true, childList: true, attributes: true });
}

interface OpenFrame {
  t: number;
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
  gap: number;
  first: number;
  last: number;
}

let domStates: Array<{ t: number; first: number }> = [];

async function readOpenFrames(page: Page, fromT = 0): Promise<OpenFrame[]> {
  await page.evaluate(() => {
    (window as unknown as { __open: { stop: boolean } }).__open.stop = true;
  });
  const all = (await page.evaluate(() => (window as unknown as { __open: { frames: unknown[] } }).__open.frames)) as OpenFrame[];
  domStates = (await page.evaluate(() => (window as unknown as { __open: { dom: unknown[] } }).__open.dom)) as typeof domStates;
  domStates = domStates.filter((d) => d.t >= fromT);
  return all.filter((f) => f.t >= fromT);
}

function reportOpening(frames: OpenFrame[], tag: string): { notAtBottom: number; oldest: number } {
  expect(frames.length, 'the sampler saw the list').toBeGreaterThan(0);
  const final = frames[frames.length - 1]!;
  const t0 = frames[0]!.t;
  const notAtBottom = frames.filter((f) => f.gap > FOLLOW_GAP_PX);
  // "A flash of the oldest rows": visible rows far from the newest ones the list settles on.
  const oldest = frames.filter((f) => f.last >= 0 && final.last - f.last > 30);
  const firstAtBottom = frames.find((f) => f.gap <= FOLLOW_GAP_PX);
  measure(`${tag}.frames`, frames.length, '');
  measure(`${tag}.framesNotAtBottom`, notAtBottom.length, '');
  measure(`${tag}.msNotAtBottom`, notAtBottom.length ? notAtBottom[notAtBottom.length - 1]!.t - notAtBottom[0]!.t : 0, 'ms');
  measure(`${tag}.msFirstRowsToAtBottom`, firstAtBottom ? firstAtBottom.t - t0 : -1, 'ms');
  measure(`${tag}.framesShowingOldestRows`, oldest.length, '');
  const oldestDom = domStates.filter((d) => d.first >= 0 && final.last - d.first > 60);
  measure(`${tag}.domStatesShowingOldestRows`, oldestDom.length, '');
  measure(`${tag}.firstFrameGap`, frames[0]!.gap);
  measure(`${tag}.firstFrameFirstRow`, frames[0]!.first, '');
  measure(`${tag}.finalFirstRow`, final.first, '');
  measure(`${tag}.maxScrollHeightJump`, frames.reduce((m, f, i) => (i ? Math.max(m, Math.abs(f.scrollHeight - frames[i - 1]!.scrollHeight)) : m), 0));
  return { notAtBottom: notAtBottom.length, oldest: Math.max(oldest.length, oldestDom.length) };
}

for (const theme of THEME_IDS) {
  test(`ring › opening › history 300 is at the bottom from the first painted frame [${theme}]`, async ({ page }) => {
    test.skip(isTouchProject(), 'on a phone the Ring is hidden at load: see the first-visit test');
    await installScrollLib(page);
    await page.addInitScript(installOpenSampler);
    await openLab(page, 'brawl', { history: 300, theme });
    await waitThemeLoaded(page, theme);
    await page.waitForTimeout(1_200);
    const frames = await readOpenFrames(page);
    const t = await timings(page);
    measure('o.timeToFirstRows', t?.durations['ring.time_to_first_rows']?.last ?? -1, 'ms');
    const r = reportOpening(frames, 'o');
    expect(r.oldest, 'frames showing the oldest rows instead of the newest').toBe(0);
    expect(r.notAtBottom, 'frames painted with the list not at the bottom').toBe(0);
    const s = await snap(page, 'ring');
    expect(lastRowVisible(s).ok).toBe(true);
  });

  test(`ring › opening › first visit to the Ring tab on a phone [${theme}]`, async ({ page }) => {
    test.skip(!isTouchProject(), 'side by side on desktop: the Ring is there at load');
    await installScrollLib(page);
    await page.addInitScript(installOpenSampler);
    await openLab(page, 'brawl', { history: 300, theme });
    await waitThemeLoaded(page, theme);
    await page.waitForTimeout(600);
    const t0 = await page.evaluate(() => performance.now());
    await showSurface(page, 'The Ring');
    await page.waitForTimeout(1_200);
    const frames = await readOpenFrames(page, t0);
    const t = await timings(page);
    measure('v.timeToFirstRows', t?.durations['ring.time_to_first_rows']?.last ?? -1, 'ms');
    const r = reportOpening(frames, 'v');
    expect(r.oldest, 'frames showing the oldest rows instead of the newest').toBe(0);
    expect(r.notAtBottom, 'frames painted with the list not at the bottom').toBe(0);
    const s = await snap(page, 'ring');
    expect(s.gap).toBeLessThanOrEqual(FOLLOW_GAP_PX);
  });
}

/** Keep Snap in the type graph for editors; also used by helper consumers. */
export type { Snap };

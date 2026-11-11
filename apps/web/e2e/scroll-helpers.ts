import { expect, test, type CDPSession, type Locator, type Page } from '@playwright/test';
import { lab, measure, openLab, showSurface, wheelBy, type FixtureName } from './lab.js';

/**
 * Shared machinery for the scroll invariants (scroll.spec.ts, scroll-soak.spec.ts).
 *
 * Everything that reads layout does so in ONE `page.evaluate` (the in-page library below) so a
 * measurement is a single consistent frame, not several round trips with the feed moving between
 * them. The library is installed with `addInitScript`, i.e. before the app's first script, which
 * is also what lets the opening test sample every animation frame from navigation.
 */

export const THEME_IDS = ['phosphor', 'millefleur'] as const;
export type ThemeId = (typeof THEME_IDS)[number];
export type Pane = 'ring' | 'console';

/** The app's own `AT_BOTTOM_THRESHOLD_PX` (hooks/useFeedAutoScroll.ts). */
export const FOLLOW_GAP_PX = 8;
/** A row the reader is looking at may move this much (sub-pixel layout, rounding). */
export const ROW_DRIFT_PX = 2;
/** A scroll gesture must not move content the opposite way by more than this. */
export const REVERSE_PX = 2;

export interface RowBox {
  /** Virtuoso's `data-item-index`. */
  i: number;
  /** Pixels from the scroller's top edge (negative = above the viewport). */
  top: number;
  bottom: number;
  text: string;
}

export interface Snap {
  t: number;
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
  /** Pixels between the viewport's bottom edge and the end of the content. */
  gap: number;
  /** Rows intersecting the viewport. */
  rows: RowBox[];
  /** The highest-index rendered row (not necessarily on screen). */
  last: RowBox | null;
  /** Number of `[data-item-index]` nodes under the scroller. */
  nodes: number;
  /** Whether the pane's `↓ Latest` button is in the DOM. */
  jump: boolean;
}

export interface GapSample {
  t: number;
  gap: number;
  jump: boolean;
}

/* ── the in-page library ───────────────────────────────────────────────────────────── */

/** Installed by `addInitScript`; runs in the page, so it may not close over anything. */
function installLib(): void {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const w = window as any;
  if (w.__sc) return;
  const LABEL: Record<string, string> = { ring: 'Ring events', console: 'Console messages' };

  const scrollerOf = (pane: string): HTMLElement | null => {
    const all = document.querySelectorAll<HTMLElement>(
      `.event-feed[aria-label="${LABEL[pane]}"][tabindex]`,
    );
    for (const el of Array.from(all)) if (el.getClientRects().length > 0 && el.clientHeight > 0) return el;
    return null;
  };

  const snap = (pane: string) => {
    const el = scrollerOf(pane);
    if (!el) return null;
    const box = el.getBoundingClientRect();
    const items = Array.from(el.querySelectorAll<HTMLElement>('[data-item-index]'));
    const all = items.map((n) => {
      const r = n.getBoundingClientRect();
      return {
        i: Number(n.getAttribute('data-item-index')),
        top: r.top - box.top,
        bottom: r.bottom - box.top,
        text: (n.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 48),
      };
    });
    let last: (typeof all)[number] | null = null;
    for (const r of all) if (!last || r.i > last.i) last = r;
    const area = el.closest('.pane-feed-area');
    return {
      t: performance.now(),
      scrollTop: el.scrollTop,
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
      gap: el.scrollHeight - el.scrollTop - el.clientHeight,
      rows: all.filter((r) => r.bottom > 0 && r.top < el.clientHeight).sort((a, b) => a.i - b.i),
      last,
      nodes: items.length,
      jump: !!area?.querySelector('.jump-to-bottom'),
    };
  };

  /** Resolve when scrollTop and scrollHeight have been unchanged for `quietMs` (by rAF ticks). */
  const idle = (pane: string, quietMs: number, maxMs: number) =>
    new Promise<{ waitedMs: number; timedOut: boolean }>((resolve) => {
      const start = performance.now();
      let lastKey = '';
      let stableSince = start;
      const tick = () => {
        const now = performance.now();
        const el = scrollerOf(pane);
        const key = el ? `${el.scrollTop}|${el.scrollHeight}|${el.clientHeight}` : 'none';
        if (key !== lastKey) {
          lastKey = key;
          stableSince = now;
        }
        if (now - stableSince >= quietMs) return resolve({ waitedMs: now - start, timedOut: false });
        if (now - start >= maxMs) return resolve({ waitedMs: now - start, timedOut: true });
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });

  let sampler: ReturnType<typeof setInterval> | null = null;
  let samples: Array<{ t: number; gap: number; jump: boolean }> = [];
  const startSampler = (pane: string, ms: number) => {
    if (sampler !== null) clearInterval(sampler);
    samples = [];
    sampler = setInterval(() => {
      const s = snap(pane);
      if (s) samples.push({ t: s.t, gap: s.gap, jump: s.jump });
    }, ms);
  };
  const stopSampler = () => {
    if (sampler !== null) clearInterval(sampler);
    sampler = null;
    const out = samples;
    samples = [];
    return out;
  };

  // Frame-time monitor: the delta between consecutive animation frames. A frame over 100 ms
  // is a visible hitch; a long main-thread task shows up here without needing PerformanceObserver.
  let frameRaf = 0;
  let frameDeltas: number[] = [];
  let framePrev = 0;
  const startFrames = () => {
    cancelAnimationFrame(frameRaf);
    frameDeltas = [];
    framePrev = 0;
    const loop = (t: number) => {
      if (framePrev) frameDeltas.push(t - framePrev);
      framePrev = t;
      frameRaf = requestAnimationFrame(loop);
    };
    frameRaf = requestAnimationFrame(loop);
  };
  const stopFrames = () => {
    cancelAnimationFrame(frameRaf);
    const d = frameDeltas;
    frameDeltas = [];
    return {
      count: d.length,
      max: d.reduce((m, x) => Math.max(m, x), 0),
      over50: d.filter((x) => x > 50).length,
      over100: d.filter((x) => x > 100).length,
      over500: d.filter((x) => x > 500).length,
    };
  };

  w.__sc = { scrollerOf, snap, idle, startSampler, stopSampler, startFrames, stopFrames };
}

/* ── Node-side wrappers ────────────────────────────────────────────────────────────── */

export async function installScrollLib(page: Page): Promise<void> {
  await page.addInitScript(installLib);
}

export async function snap(page: Page, pane: Pane): Promise<Snap> {
  const s = await page.evaluate(
    (p) => (window as unknown as { __sc: { snap(p: string): unknown } }).__sc.snap(p),
    pane,
  );
  if (!s) throw new Error(`no visible ${pane} scroller`);
  return s as Snap;
}

/** Wait until the scroller has not moved or resized for `quietMs`. */
export async function idle(page: Page, pane: Pane, quietMs = 200, maxMs = 6_000): Promise<number> {
  const r = await page.evaluate(
    ([p, q, m]) =>
      (window as unknown as { __sc: { idle(p: string, q: number, m: number): Promise<{ waitedMs: number }> } }).__sc.idle(
        p as string,
        q as number,
        m as number,
      ),
    [pane, quietMs, maxMs] as const,
  );
  return r.waitedMs;
}

export async function startSampler(page: Page, pane: Pane, ms = 100): Promise<void> {
  await page.evaluate(
    ([p, m]) => (window as unknown as { __sc: { startSampler(p: string, m: number): void } }).__sc.startSampler(p as string, m as number),
    [pane, ms] as const,
  );
}

export async function stopSampler(page: Page): Promise<GapSample[]> {
  return page.evaluate(() => (window as unknown as { __sc: { stopSampler(): unknown } }).__sc.stopSampler()) as Promise<GapSample[]>;
}

export interface FrameStats {
  count: number;
  max: number;
  over50: number;
  over100: number;
  over500: number;
}
export async function startFrames(page: Page): Promise<void> {
  await page.evaluate(() => (window as unknown as { __sc: { startFrames(): void } }).__sc.startFrames());
}
export async function stopFrames(page: Page): Promise<FrameStats> {
  return page.evaluate(() => (window as unknown as { __sc: { stopFrames(): unknown } }).__sc.stopFrames()) as Promise<FrameStats>;
}

/** Longest run of consecutive samples (by wall time) for which `pred` held. */
export function longestStretchMs(samples: GapSample[], pred: (s: GapSample) => boolean): number {
  let best = 0;
  let from: number | null = null;
  let prevT = 0;
  for (const s of samples) {
    if (pred(s)) {
      if (from === null) from = s.t;
      best = Math.max(best, s.t - from);
    } else {
      from = null;
    }
    prevT = s.t;
  }
  void prevT;
  return best;
}

/* ── opening a lab, per pane ───────────────────────────────────────────────────────── */

export interface SetupOpts {
  history?: number;
  theme?: ThemeId;
  /** Console only: how many echo rows to type so the feed overflows. */
  seedRows?: number;
}

export function paneTab(pane: Pane): 'The Ring' | 'Console' {
  return pane === 'ring' ? 'The Ring' : 'Console';
}

export function isTouchProject(): boolean {
  return !!test.info().project.use.hasTouch;
}

export function scrollerLocator(page: Page, pane: Pane): Locator {
  const label = pane === 'ring' ? 'Ring events' : 'Console messages';
  return page.locator(`.event-feed[aria-label="${label}"][tabindex]`).locator('visible=true');
}

/** Wait for a lazy theme's chunk to have been fetched, then for layout to go quiet. */
export async function waitThemeLoaded(page: Page, theme: ThemeId): Promise<void> {
  if (theme === 'phosphor') return;
  await page
    .waitForFunction(() => performance.getEntriesByType('resource').some((r) => /millefleur/i.test(r.name)), null, {
      timeout: 10_000,
    })
    .catch(() => undefined);
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  await page.waitForTimeout(400);
}

const LOREM =
  'the minotaur circles the ring while the crowd roars and a very long line of console narration keeps wrapping onto a second line for the reader';

/** Type `n` commands into the Console; each is echoed back as one row. */
export async function typeCommands(page: Page, n: number, delayMs = 0, tag = 'row'): Promise<void> {
  const input = page.locator('#console-input').locator('visible=true');
  for (let k = 0; k < n; k++) {
    await input.fill(`${tag} ${k} ${LOREM}`);
    await input.press('Enter');
    if (delayMs) await page.waitForTimeout(delayMs);
  }
}

export async function openFeed(
  page: Page,
  pane: Pane,
  fixture: FixtureName,
  opts: SetupOpts = {},
): Promise<void> {
  await installScrollLib(page);
  await openLab(page, fixture, {
    ...(opts.history !== undefined ? { history: opts.history } : {}),
    ...(opts.theme ? { theme: opts.theme } : {}),
  });
  await waitThemeLoaded(page, opts.theme ?? 'phosphor');
  await showSurface(page, paneTab(pane));
  await page.waitForFunction((p) => !!(window as unknown as { __sc: { scrollerOf(p: string): unknown } }).__sc.scrollerOf(p), pane);
  if (pane === 'console' && opts.seedRows) {
    await typeCommands(page, opts.seedRows, 0, 'seed');
  }
  await idle(page, pane, 400, 8_000);
}

/** The setups every test shares: what each pane's "a feed with history" looks like. */
export const SETUP: Record<Pane, { fixture: FixtureName; history: number; seedRows: number }> = {
  // brawl at 300: the stretch after it has card frames (302, 307, 326, 331, 336, 354 ...).
  ring: { fixture: 'brawl', history: 300, seedRows: 0 },
  // The Console shows this viewer's private events plus the HIGHLIGHT rows (NAT 20, BIG HIT, KILL)
  // it derives from the public ones. Measured on brawl: the rows appear at event indices 25, 77,
  // 97, 100, 167, 192, 254, 325, 349, 428. History 160 leaves 167 and 192 upcoming, so push(8)
  // delivers one Console row and push(40) two. (ring.xp / ring.loss draw no Console row.)
  console: { fixture: 'brawl', history: 160, seedRows: 40 },
};

export async function setup(page: Page, pane: Pane, theme: ThemeId, over: Partial<SetupOpts> = {}): Promise<void> {
  const s = SETUP[pane];
  await openFeed(page, pane, s.fixture, { history: s.history, seedRows: s.seedRows, theme, ...over });
}

/** Deliver `n` fixture events (Ring: public ones; Console: only the private ones show). */
export async function push(page: Page, n: number): Promise<void> {
  await lab(page, 'push', n);
}

/* ── jump button ───────────────────────────────────────────────────────────────────── */

export async function jumpVisible(page: Page, pane: Pane): Promise<boolean> {
  return (await snap(page, pane)).jump;
}

export function jumpButton(page: Page, pane: Pane): Locator {
  const label = pane === 'ring' ? 'Jump to latest events' : 'Jump to latest messages';
  return page.getByRole('button', { name: label }).locator('visible=true');
}

/* ── gestures ──────────────────────────────────────────────────────────────────────── */

const cdpSessions = new WeakMap<Page, CDPSession>();

async function cdp(page: Page): Promise<CDPSession> {
  let s = cdpSessions.get(page);
  if (!s) {
    s = await page.context().newCDPSession(page);
    cdpSessions.set(page, s);
  }
  return s;
}

/**
 * A reader's scroll gesture on the pane's feed. `px` > 0 reveals OLDER content (scrolls up),
 * `px` < 0 goes back toward the newest.
 *
 * Desktop: a real mouse wheel. Phone on Chromium: a real touch drag through the browser's input
 * pipeline (`Input.synthesizeScrollGesture`, touch source, fling suppressed), which fires
 * touchstart/touchmove and is what the app's `onTouchMove` intent note listens for. Phone on any
 * other engine has no equivalent public API in Playwright, and mobile WebKit refuses the wheel:
 * see `wheelBy` in `lab.ts` for the fallback and what it does not prove.
 */
export async function gesture(page: Page, pane: Pane, px: number): Promise<void> {
  const box = await scrollerLocator(page, pane).boundingBox();
  if (!box) throw new Error('scroller has no box');
  const x = Math.round(box.x + box.width / 2);
  const y = Math.round(box.y + box.height / 2);
  if (!isTouchProject()) {
    await page.mouse.move(x, y);
    await page.mouse.wheel(0, -px);
    return;
  }
  if (await isChromium(page)) {
    await touchDrag(page, x, y, px);
    return;
  }
  await wheelBy(page, scrollerLocator(page, pane), -px);
}

/**
 * Chrome's touch slop: a drag scrolls by (finger travel - slop), measured as exactly 15 px here
 * (a 135 px drag scrolls 120 px). Added so a nominal 120 px gesture scrolls 120 px.
 */
const TOUCH_SLOP_PX = 15;

/**
 * A real touch drag through the browser's input pipeline (`Input.dispatchTouchEvent`):
 * touchstart, 16 ms-spaced touchmoves 20 px apart, four stationary touchmoves so the release
 * carries no fling velocity (a plain pause before touchend still flung 20-50 px about half the
 * time on the Console), touchend. `Input.synthesizeScrollGesture` was tried first and does nothing under
 * mobile emulation (it returns, the scroller does not move). `px` > 0 drags the finger DOWN
 * (reveals older content), < 0 drags it up.
 */
async function touchDrag(page: Page, x: number, y: number, px: number): Promise<void> {
  const session = await cdp(page);
  const dir = px >= 0 ? 1 : -1;
  const total = Math.abs(px) + TOUCH_SLOP_PX;
  const stepPx = 20;
  const moves = Math.ceil(total / stepPx);
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
  for (let i = 1; i <= moves; i++) {
    const d = Math.min(total, i * stepPx);
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y + dir * d, id: 1 }] });
    await page.waitForTimeout(16);
  }
  const endY = y + dir * total;
  for (let i = 0; i < 4; i++) {
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: endY, id: 1 }] });
    await page.waitForTimeout(16);
  }
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

async function isChromium(page: Page): Promise<boolean> {
  return page.evaluate(() => /Chrome\//.test(navigator.userAgent) && !/Edg\//.test(navigator.userAgent));
}

/** A gesture followed by waiting for the scroll to come to rest. */
export async function gestureAndSettle(page: Page, pane: Pane, px: number, quietMs = 120): Promise<Snap> {
  await gesture(page, pane, px);
  await idle(page, pane, quietMs, 2_000);
  return snap(page, pane);
}

/** Scroll up (older) until at least `px` pixels were travelled; returns the real distance. */
export async function scrollUpBy(page: Page, pane: Pane, px: number, step = 120): Promise<number> {
  const before = await snap(page, pane);
  let moved = 0;
  let stalled = 0;
  let guard = 0;
  while (moved < px && guard++ < 200) {
    const s = await gestureAndSettle(page, pane, Math.min(step, px - moved));
    const now = before.scrollTop - s.scrollTop;
    stalled = now === moved ? stalled + 1 : 0;
    moved = now;
    if (s.scrollTop <= 0) break;
    if (stalled >= 4) throw new Error(`gestures stopped moving the feed after ${moved}px`);
  }
  return moved;
}

/* ── assertions ────────────────────────────────────────────────────────────────────── */

/** Is the last rendered row's bottom edge inside the viewport (and its top, unless it is taller than it)? */
export function lastRowVisible(s: Snap): { ok: boolean; bottomGap: number } {
  if (!s.last) return { ok: false, bottomGap: Number.NaN };
  const bottomGap = s.last.bottom - s.clientHeight; // > 0 means cut off at the bottom
  const tall = s.last.bottom - s.last.top > s.clientHeight;
  const topOk = tall || s.last.top >= -1;
  // The same 8 px the app itself calls "at the bottom": the cut-off part is row padding.
  return { ok: bottomGap <= FOLLOW_GAP_PX && topOk, bottomGap };
}

/**
 * The feed is following: after it settles, the gap is within the app's own threshold, the last
 * rendered row is on screen and the `↓ Latest` button is gone. Records the pixels.
 */
export async function expectPinned(page: Page, pane: Pane, name: string, quietMs = 400): Promise<Snap> {
  const waited = await idle(page, pane, quietMs, 8_000);
  const s = await snap(page, pane);
  const vis = lastRowVisible(s);
  measure(`${name}.gap`, s.gap);
  measure(`${name}.lastRowBottomGap`, vis.bottomGap);
  measure(`${name}.settleMs`, waited, 'ms');
  expect(s.gap, `${name}: gap to the bottom after settling`).toBeLessThanOrEqual(FOLLOW_GAP_PX);
  expect(vis.ok, `${name}: last row fully visible (bottomGap ${vis.bottomGap.toFixed(1)}px)`).toBe(true);
  expect(s.jump, `${name}: ↓ Latest hidden while following`).toBe(false);
  return s;
}

/** Counters from `window.__feedTimings`. */
export async function counters(page: Page): Promise<Record<string, number>> {
  const t = await lab<{ counters: Record<string, number> } | null>(page, 'timings');
  return t?.counters ?? {};
}

export async function timings(page: Page): Promise<{
  counters: Record<string, number>;
  durations: Record<string, { last: number }>;
} | null> {
  return lab(page, 'timings');
}

/** Pick the first row that is fully inside the viewport (top >= 0). */
export function firstFullyVisible(s: Snap): RowBox {
  const row = s.rows.find((r) => r.top >= 0 && r.bottom <= s.clientHeight) ?? s.rows.find((r) => r.top >= 0);
  if (!row) throw new Error('no fully visible row');
  return row;
}

export function rowByIndex(s: Snap, i: number): RowBox | undefined {
  return s.rows.find((r) => r.i === i);
}

/** Rows present in both snapshots, with their on-screen top in each. */
export function commonRows(a: Snap, b: Snap): Array<{ i: number; before: number; after: number }> {
  const out: Array<{ i: number; before: number; after: number }> = [];
  for (const r of a.rows) {
    const o = rowByIndex(b, r.i);
    if (o) out.push({ i: r.i, before: r.top, after: o.top });
  }
  return out;
}

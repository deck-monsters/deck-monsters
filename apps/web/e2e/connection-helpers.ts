import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { lab, openLab, showSurface, measure, ringScroller, wheelBy, type FixtureName, type OpenOptions } from './lab.js';

/*
 * Helpers for the connection scenarios (connection.spec.ts). These MEASURE the app; none of
 * them is allowed to make a scenario easier. Everything here lives in the e2e folder: the lab
 * (`src/lab`) and the app are untouched.
 *
 * Time. The 20 s watchdog (HEARTBEAT_TIMEOUT_MS in utils/ring-feed-connection.ts) and the lab's 8 s heartbeat
 * are in-page `setTimeout`/`setInterval`, so Playwright's clock (`page.clock`) drives both.
 * The clock is installed BEFORE navigation and left to flow naturally (never paused), so React,
 * the feed's rAF and `performance.now` (which the timings module reads) all stay consistent.
 * `advance()` jumps it in small steps and yields to the page's real task queue between steps,
 * so a state change the watchdog causes is committed and observed within one step.
 */

type Fixture = {
  events: Array<{ id: string; atMs: number; data: { type: string; scope: string; timestamp: number; targetUserId?: string; text?: string } }>;
  viewerUserId: string;
};

const fixtureCache = new Map<string, Fixture>();

export function loadFixture(name: string): Fixture {
  let fixture = fixtureCache.get(name);
  if (!fixture) {
    // Playwright runs with cwd = apps/web (where playwright.config.ts lives).
    const file = path.resolve(process.cwd(), 'src/lab/fixtures', `${name}.json`);
    fixture = JSON.parse(readFileSync(file, 'utf8')) as Fixture;
    fixtureCache.set(name, fixture);
  }
  return fixture;
}

/** Mirrors `shouldRenderRingEvent` (utils/ring-feed-events.ts) and the Ring's public-only rule. */
function ringRenders(e: Fixture['events'][number]): boolean {
  return e.data.scope === 'public' && e.data.type !== 'ring.fightResolved' && e.data.type !== 'ring.state' && e.data.type !== 'system.gap';
}

export interface Snapshot {
  now: number;
  banner: boolean;
  ringHeader: string;
  headerReconnecting: boolean;
  headerConnecting: boolean;
  markers: string[];
  tailIso: string | null;
  tailType: string | null;
  rows: number;
  counters: Record<string, number>;
  durations: Record<string, number>;
  marks: Record<string, number>;
  state: { subscriptions: number; down: boolean; stalled: boolean; published: number; latencyMs: number };
  consoleReconnecting: boolean;
}

/** Everything the scenarios read about the page, in one round trip. */
export async function snapshot(page: Page): Promise<Snapshot> {
  return page.evaluate(() => {
    const w = window as unknown as {
      __feedLab: { state(): Snapshot['state'] };
      __feedTimings: { snapshot(): { counters: Record<string, number>; marks: Record<string, number>; durations: Record<string, { last: number }> } };
    };
    const shown = (el: Element) => (el as HTMLElement).getClientRects().length > 0 && !(el as HTMLElement).closest('[hidden]');
    const banner = [...document.querySelectorAll('.connection-banner.reconnecting')].some(shown);
    const ringSection = [...document.querySelectorAll('section[aria-label^="The Ring"]')].find(shown);
    const consoleSection = [...document.querySelectorAll('section[aria-label^="Your Console"]')].find(shown);
    const headerText = ringSection?.querySelector('.pane-header')?.textContent ?? '';
    const feed = [...document.querySelectorAll('.event-feed[aria-label="Ring events"]')].find(shown);
    const markers = feed ? [...feed.querySelectorAll('.feed-marker')].map((m) => m.textContent ?? '') : [];
    const rowEls = feed ? [...feed.querySelectorAll('li[data-event-at]')] : [];
    const tail = rowEls[rowEls.length - 1] as HTMLElement | undefined;
    const t = w.__feedTimings.snapshot();
    return {
      now: performance.now(),
      banner,
      ringHeader: headerText,
      headerReconnecting: /reconnecting…/.test(headerText),
      headerConnecting: /connecting…/.test(headerText) && !/reconnecting…/.test(headerText),
      markers,
      tailIso: tail?.getAttribute('data-event-at') ?? null,
      tailType: tail?.getAttribute('data-event-type') ?? null,
      rows: rowEls.length,
      counters: t.counters,
      marks: t.marks,
      durations: Object.fromEntries(Object.entries(t.durations).map(([k, v]) => [k, v.last])),
      state: w.__feedLab.state(),
      consoleReconnecting: consoleSection ? /reconnecting/.test(consoleSection.querySelector('.pane-header')?.textContent ?? '') : false,
    };
  });
}

/** One macrotask on the page's REAL queue (MessageChannel is not faked), so React can commit. */
export async function flush(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const c = new MessageChannel();
        let n = 0;
        c.port1.onmessage = () => {
          if (++n >= 3) resolve();
          else c.port2.postMessage(0);
        };
        c.port2.postMessage(0);
      })
  );
}

/** Page-clock "now" (fake `performance.now`). */
export async function clockNow(page: Page): Promise<number> {
  return page.evaluate(() => performance.now());
}

export interface AdvanceResult {
  /** Fake-clock ms advanced. */
  elapsed: number;
  /** Fake `performance.now` when the loop stopped. */
  at: number;
  met: boolean;
}

/**
 * Advance the fake clock by up to `totalMs` in `stepMs` steps (`runFor`, so every timer in the
 * window fires in order), stopping early at the first step after which `until` holds.
 */
export async function advance(
  page: Page,
  totalMs: number,
  opts: { stepMs?: number; until?: (s: Snapshot) => boolean } = {}
): Promise<AdvanceResult> {
  const step = opts.stepMs ?? 250;
  const start = await clockNow(page);
  let done = 0;
  if (opts.until) {
    await flush(page);
    if (opts.until(await snapshot(page))) return { elapsed: 0, at: start, met: true };
  }
  while (done < totalMs) {
    const dt = Math.min(step, totalMs - done);
    await page.clock.runFor(dt);
    done += dt;
    await flush(page);
    if (opts.until) {
      const s = await snapshot(page);
      if (opts.until(s)) return { elapsed: done, at: s.now, met: true };
    }
  }
  return { elapsed: done, at: await clockNow(page), met: !opts.until };
}

/** Open the lab with a fake clock installed first. Returns the clock epoch (fake `performance.now`). */
export async function openClocked(page: Page, fixture: FixtureName, opts: OpenOptions & { surface?: 'The Ring' | 'Console' } = {}): Promise<void> {
  await page.clock.install();
  await openLab(page, fixture, opts);
  await showSurface(page, opts.surface ?? 'The Ring');
  await expect.poll(async () => (await snapshot(page)).tailIso, { timeout: 15_000 }).not.toBeNull();
  await flush(page);
}

/** Show the Ring and wait for its history rows (real clock). */
export async function openPlain(page: Page, fixture: FixtureName, opts: OpenOptions = {}): Promise<void> {
  await openLab(page, fixture, opts);
  await showSurface(page, 'The Ring');
  await expect.poll(async () => (await snapshot(page)).tailIso, { timeout: 15_000 }).not.toBeNull();
}

/** Pretend the page is hidden / visible, the way a locked phone or background tab looks to the app. */
export async function setVisibility(page: Page, state: 'hidden' | 'visible'): Promise<void> {
  await page.evaluate((s) => {
    // A real background page runs no animation frames; hold them while "hidden" so the faked
    // clock does not burn CPU on frames nobody would get (and the page behaves as it would).
    const w = window as unknown as { __rafPatched?: boolean; __rafHeld?: FrameRequestCallback[] };
    if (!w.__rafPatched) {
      w.__rafPatched = true;
      w.__rafHeld = [];
      const real = window.requestAnimationFrame.bind(window);
      window.requestAnimationFrame = (cb: FrameRequestCallback) => {
        if (document.visibilityState === 'hidden') {
          w.__rafHeld!.push(cb);
          return 0;
        }
        return real(cb);
      };
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState !== 'visible') return;
        const held = w.__rafHeld!.splice(0);
        for (const cb of held) real(cb);
      });
    }
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => s });
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => s === 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
  }, state);
  await flush(page);
}

/**
 * The browser's own `offline`/`online` events, fired by CDP-level network emulation. (The lab's
 * transport is in-page, so this does not affect it; it shows only whether the app reacts.)
 */
export async function setOffline(page: Page, offline: boolean): Promise<void> {
  await page.context().setOffline(offline);
  await flush(page);
}

export function ringEventsPublishedSoFar(fixtureName: string, published: number): Fixture['events'] {
  return loadFixture(fixtureName).events.slice(0, published).filter(ringRenders);
}

export interface Audit {
  /** Ring-renderable events the lab published (what the Ring should show). */
  published: number;
  /** Published, renderable ids that no delivery (history, replay or live) ever carried to the client. */
  neverDelivered: number;
  /** Expected rows that are not in the rendered feed (multiset by timestamp+type). */
  lost: number;
  /** Rendered rows beyond what was published (a row shown twice, or one that should not be there). */
  duplicated: number;
  /** Delivered more than once at the transport (replay overlap), dropped by the pane's `seenRef`. */
  duplicateDeliveries: number;
  appended: number;
  duplicateDropped: number;
  /** 1 when the first sweep disagreed and a second one was taken. */
  rereads: number;
  /** Rendered order against publish order. */
  order: 'ok' | string;
  domRows: number;
  /** Markers in the feed, in order, with the index among all rows. */
  markers: Array<{ at: number; text: string }>;
  /** Which expected / unexpected rows (`iso|type`), up to 5 of each, when lost or doubled. */
  missing: string[];
  extra: string[];
  /** Every rendered row (events and markers), for position questions. */
  rows: FeedRow[];
}

/**
 * Compare what the lab published with what the Ring renders.
 *
 * The whole feed is read by sweeping the scroller from top
 * to bottom and collecting every row by its `data-index` (rows are keyed by timestamp +
 * type: the DOM carries no event ids). `ring.state` frames are excluded on both sides (the
 * pane uses them for timers and the lab's history contains them).
 */
export async function audit(page: Page, fixtureName: string): Promise<Audit> {
  const [snap, published, deliveries] = await Promise.all([
    snapshot(page),
    lab<number>(page, 'published'),
    lab<Array<{ id: string; via: 'history' | 'replay' | 'live' }>>(page, 'deliveries'),
  ]);
  const fixture = loadFixture(fixtureName);
  const byId = new Map(fixture.events.map((e) => [e.id, e]));
  const expected = ringEventsPublishedSoFar(fixtureName, published);
  const delivered = new Set<string>();
  let deliveriesOfExpected = 0;
  for (const d of deliveries) {
    const e = byId.get(d.id);
    if (!e || !ringRenders(e)) continue;
    deliveriesOfExpected += 1;
    delivered.add(d.id);
  }
  const neverDelivered = expected.filter((e) => !delivered.has(e.id)).length;

  const want = expected.map((e) => `${new Date(e.data.timestamp).toISOString()}|${e.data.type}`);
  const sweep = async () => {
    const r = await readWholeFeed(page);
    const keys = r.filter((x) => x.kind === 'event' && !x.key.endsWith('|ring.state')).map((x) => x.key);
    return { rows: r, keys };
  };
  // The sweep scrolls a virtualised list with the mouse wheel and can occasionally miss a row
  // (a harness artefact, not an app one: one miss in ~60 sweeps). A real loss shows in the
  // second sweep too, so a clean second sweep is taken as the truth and the retry is recorded.
  let { rows, keys: dom } = await sweep();
  let rereads = 0;
  if (dom.length !== want.length) {
    rereads = 1;
    await page.waitForTimeout(300);
    const second = await sweep();
    // Rows are keyed by `data-index` and nothing is arriving, so the sweeps can be merged:
    // a row either sweep saw is a row that was rendered.
    const merged = new Map<number, FeedRow>();
    for (const r of [...rows, ...second.rows]) merged.set(r.index, r);
    rows = [...merged.values()].sort((x, y) => x.index - y.index);
    dom = rows.filter((x) => x.kind === 'event' && !x.key.endsWith('|ring.state')).map((x) => x.key);
  }
  const count = (xs: string[]) => {
    const m = new Map<string, number>();
    for (const x of xs) m.set(x, (m.get(x) ?? 0) + 1);
    return m;
  };
  const have = count(dom);
  const need = count(want);
  let lost = 0;
  let duplicated = 0;
  const missing: string[] = [];
  const extra: string[] = [];
  for (const [k, n] of need) {
    const d = Math.max(0, n - (have.get(k) ?? 0));
    lost += d;
    if (d && missing.length < 5) missing.push(k);
  }
  for (const [k, n] of have) {
    const d = Math.max(0, n - (need.get(k) ?? 0));
    duplicated += d;
    if (d && extra.length < 5) extra.push(k);
  }
  let order: Audit['order'] = 'ok';
  if (lost === 0 && duplicated === 0) {
    const bad = dom.findIndex((d, i) => d !== want[i]);
    if (bad !== -1) order = `first out-of-order row at ${bad}: ${dom[bad]} (expected ${want[bad]})`;
  } else {
    order = 'not compared (rows lost or doubled)';
  }
  return {
    published: expected.length,
    neverDelivered,
    lost,
    duplicated,
    duplicateDeliveries: deliveriesOfExpected - delivered.size,
    appended: snap.counters['ring.events.appended'] ?? 0,
    duplicateDropped: snap.counters['ring.events.duplicate_dropped'] ?? 0,
    rereads,
    order,
    domRows: dom.length,
    markers: rows.filter((r) => r.kind === 'marker').map((r) => ({ at: r.index, text: r.key })),
    missing,
    extra,
    rows,
  };
}

export interface FeedRow {
  index: number;
  kind: 'event' | 'marker';
  key: string;
}

/**
 * Every row of the visible Ring feed, in order, read by scrolling the list from the
 * top to the bottom with real mouse-wheel input (each row carries a
 * `data-index`). Setting `scrollTop` from script does not work here: the pane's auto-follow
 * pins the list back to the bottom, because a script is not a gesture. Leaves the list at the
 * bottom, where a reader following the feed would be.
 */
export async function readWholeFeed(page: Page): Promise<FeedRow[]> {
  const feed = page.locator('.event-feed[aria-label="Ring events"]').locator('visible=true');
  const box = await feed.boundingBox();
  if (!box) return [];
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  const rows = new Map<number, FeedRow>();
  const read = () =>
    page.evaluate(async () => {
      const shown = (el: Element) => (el as HTMLElement).getClientRects().length > 0 && !(el as HTMLElement).closest('[hidden]');
      const scroller = [...document.querySelectorAll('.event-feed[aria-label="Ring events"]')].find(shown) as HTMLElement;
      // Wait for the scroll position to stop moving (wheel scrolling can animate).
      let last = -1;
      for (let i = 0; i < 40; i++) {
        await new Promise<void>((r) => requestAnimationFrame(() => r()));
        if (scroller.scrollTop === last) break;
        last = scroller.scrollTop;
      }
      const found: Array<{ index: number; kind: 'event' | 'marker'; key: string }> = [];
      for (const li of scroller.querySelectorAll('[data-index]')) {
        const index = Number(li.getAttribute('data-index'));
        const inner = li.matches('li[data-event-at], li.feed-marker') ? li : li.querySelector('li[data-event-at], li.feed-marker');
        if (!inner) continue;
        if (inner.classList.contains('feed-marker')) found.push({ index, kind: 'marker', key: inner.textContent ?? '' });
        else found.push({ index, kind: 'event', key: `${inner.getAttribute('data-event-at')}|${inner.getAttribute('data-event-type')}` });
      }
      return { top: scroller.scrollTop, height: scroller.scrollHeight, client: scroller.clientHeight, found };
    });
  // Up to the top.
  for (let i = 0; i < 80; i++) {
    await wheelBy(page, ringScroller(page), -3000);
    const m = await read();
    if (m.top <= 0) break;
  }
  // Down a page at a time.
  for (let i = 0; i < 400; i++) {
    const m = await read();
    for (const r of m.found) rows.set(r.index, r);
    if (m.top + m.client >= m.height - 2) break;
    await wheelBy(page, ringScroller(page), Math.max(60, Math.floor(m.client * 0.5)));
  }
  return [...rows.values()].sort((x, y) => x.index - y.index);
}

/** Record the audit's numbers on the test. */
export function recordAudit(prefix: string, a: Audit): void {
  measure(`${prefix}.lost`, a.lost, ' events');
  measure(`${prefix}.duplicated`, a.duplicated, ' rows');
  measure(`${prefix}.neverDelivered`, a.neverDelivered, ' events');
  measure(`${prefix}.duplicateDeliveries`, a.duplicateDeliveries, ' deliveries');
  note(`${prefix}: published=${a.published} rendered=${a.domRows} lost=${a.lost} dup=${a.duplicated} order=${a.order} rereads=${a.rereads} markers=${JSON.stringify(a.markers.map((m) => m.text))} appended=${a.appended} dropped=${a.duplicateDropped}${a.missing.length ? ` missing=${a.missing.join(';')}` : ''}${a.extra.length ? ` extra=${a.extra.join(';')}` : ''}`);
}

export function note(text: string): void {
  test.info().annotations.push({ type: 'note', description: text });
  // eslint-disable-next-line no-console
  console.log(`[${test.info().project.name}] ${test.info().title}: ${text}`);
}

export interface ProbeEntry {
  /** Fake `performance.now` when the DOM mutation was observed. */
  t: number;
  kind: 'banner+' | 'banner-' | 'header-reconnecting+' | 'header-reconnecting-' | 'console-reconnecting+' | 'console-reconnecting-' | 'marker' | 'row';
  detail?: string;
}

/**
 * Watch the DOM from inside the page and timestamp (fake `performance.now`) every change a
 * reader would see: the Ring's "-- reconnecting --" banner, the "reconnecting…" header word in
 * Ring and Console, a new "connection lost"/"reconnected"/"joined" divider, and a new event
 * row at the end of the Ring feed (by `data-index`). Observed with a
 * MutationObserver, so a state that lasts only a frame is still caught.
 */
export async function installProbe(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as { __probe?: unknown[]; __probeStop?: () => void };
    w.__probeStop?.();
    const log: Array<{ t: number; kind: string; detail?: string }> = [];
    w.__probe = log;
    const shown = (el: Element) => (el as HTMLElement).getClientRects().length > 0 && !(el as HTMLElement).closest('[hidden]');
    let banner = false;
    let ringHdr = false;
    let conHdr = false;
    const seenMarkers = new Set<string>();
    let maxRow = -1;
    const check = () => {
      const t = performance.now();
      const b = [...document.querySelectorAll('.connection-banner.reconnecting')].some(shown);
      if (b !== banner) { banner = b; log.push({ t, kind: b ? 'banner+' : 'banner-' }); }
      const ring = [...document.querySelectorAll('section[aria-label^="The Ring"]')].find(shown);
      const con = [...document.querySelectorAll('section[aria-label^="Your Console"]')].find(shown);
      const rh = /reconnecting…/.test(ring?.querySelector('.pane-header')?.textContent ?? '');
      if (rh !== ringHdr) { ringHdr = rh; log.push({ t, kind: rh ? 'header-reconnecting+' : 'header-reconnecting-' }); }
      const ch = /reconnecting…/.test(con?.querySelector('.pane-header')?.textContent ?? '');
      if (ch !== conHdr) { conHdr = ch; log.push({ t, kind: ch ? 'console-reconnecting+' : 'console-reconnecting-' }); }
      const feed = [...document.querySelectorAll('.event-feed[aria-label="Ring events"]')].find(shown);
      if (feed) {
        for (const li of feed.querySelectorAll('li.feed-marker')) {
          const idx = li.closest('[data-index]')?.getAttribute('data-index') ?? '?';
          const key = `${idx}:${li.textContent}`;
          if (!seenMarkers.has(key)) { seenMarkers.add(key); log.push({ t, kind: 'marker', detail: `${li.textContent}@${idx}` }); }
        }
        for (const li of feed.querySelectorAll('li[data-event-at]')) {
          const idx = Number(li.closest('[data-index]')?.getAttribute('data-index') ?? li.getAttribute('data-index') ?? '-1');
          if (idx > maxRow) { maxRow = idx; log.push({ t, kind: 'row', detail: String(idx) }); }
        }
      }
    };
    const mo = new MutationObserver(check);
    mo.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['hidden', 'class', 'data-index'] });
    w.__probeStop = () => mo.disconnect();
    check();
  });
}

export async function probeLog(page: Page): Promise<ProbeEntry[]> {
  return page.evaluate(() => ((window as unknown as { __probe?: ProbeEntry[] }).__probe ?? []).map((e) => ({ ...e })));
}

/** Entries after `t` (fake ms). */
export function after(log: ProbeEntry[], t: number, kind: ProbeEntry['kind']): ProbeEntry | undefined {
  return log.find((e) => e.t >= t && e.kind === kind);
}

/** Event rows (not `ring.state`, not markers) strictly between two markers, or before/after one. */
export function eventRowsBetween(a: Audit, fromMarker: string | null, toMarker: string | null, occurrence = 'last'): number {
  const pick = (text: string) => {
    const hits = a.markers.filter((m) => m.text === text);
    return occurrence === 'last' ? hits[hits.length - 1] : hits[0];
  };
  const from = fromMarker ? pick(fromMarker)?.at ?? -1 : -1;
  const to = toMarker ? pick(toMarker)?.at ?? Number.POSITIVE_INFINITY : Number.POSITIVE_INFINITY;
  return a.rows.filter((r) => r.kind === 'event' && !r.key.endsWith('|ring.state') && r.index > from && r.index < to).length;
}

/** Page-side `Date.now() - performance.now()`: maps the lab's `Date.now()` log times onto the probe's clock. */
export async function clockOffset(page: Page): Promise<number> {
  return page.evaluate(() => Date.now() - performance.now());
}

/**
 * Re-open the lab's fixture with a link latency in place from the very first frame/query.
 * `open()` always builds a transport with latency 0, and the lab API has no way to ask for
 * another, so the latency is set from a MessageChannel poll that runs between `open()`
 * creating the new transport and React mounting the new tree (the new transport is detected by
 * its empty connection log). The page itself (JS, chunks, fonts) is already loaded, so this is a
 * remount of the room tree, not a cold page load. Timings are reset first.
 */
export async function reopenWithLatency(page: Page, fixture: string, latencyMs: number, historyCount: number): Promise<void> {
  await page.evaluate(
    async ({ fixture, latencyMs, historyCount }) => {
      const w = window as unknown as {
        __feedTimings: { reset(): void };
        __feedLab: {
          open(name: string, o?: { historyCount?: number }): Promise<void>;
          setLatency(ms: number): void;
          connectionLog(): unknown[];
        };
      };
      const mc = () =>
        new Promise<void>((r) => {
          const c = new MessageChannel();
          c.port1.onmessage = () => r();
          c.port2.postMessage(0);
        });
      w.__feedTimings.reset();
      const opening = w.__feedLab.open(fixture, { historyCount });
      for (let i = 0; i < 100_000; i++) {
        if (w.__feedLab.connectionLog().length === 0) {
          w.__feedLab.setLatency(latencyMs);
          break;
        }
        await mc();
      }
      void opening;
    },
    { fixture, latencyMs, historyCount }
  );
}

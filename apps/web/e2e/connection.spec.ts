import { expect, test, type Page } from '@playwright/test';
import { lab, measure, openLab, showSurface } from './lab.js';
import {
  advance,
  after,
  audit,
  clockNow,
  clockOffset,
  eventRowsBetween,
  flush,
  installProbe,
  note,
  openClocked,
  probeLog,
  recordAudit,
  reopenWithLatency,
  ringEventsPublishedSoFar,
  setOffline,
  setVisibility,
  snapshot,
  type Audit,
  type ProbeEntry,
} from './connection-helpers.js';

/*
 * Connection scenarios over the feed lab (docs/roadmap/52, task B3, lab edition).
 *
 * WHAT THIS MEASURES: the room UI's reaction to faults in the feed subscription, on the lab's
 * scripted in-page link. WHAT IT CANNOT: tRPC's own WebSocket client (wsLink: its reconnect,
 * its backoff, its keep-alive) is not in the loop: the lab's link replaces it, so the browser
 * socket, the real network, the server's replay (bus buffer, `room_events` paging, caps) and
 * the proxy are all absent. A later real-server suite owns those.
 *
 * Time: scenarios with the 50 s watchdog use Playwright's clock (see connection-helpers.ts),
 * so they take seconds, not minutes. The first-load and slow-link scenarios (7, 8) use real
 * time because the quantity measured is real latency.
 *
 * Every number is recorded with `measure()` / an annotation. The hard expectations are
 * correctness (nothing lost, nothing doubled, no false "reconnecting") and the app's own
 * documented contract (50 s watchdog); they are `expect.soft` so one failure never hides the
 * remaining numbers. A slow-but-in-contract behaviour is a finding in the report, not a failure.
 */

const FIXTURE = 'duel';
const HISTORY = 60;
const WATCHDOG_MS = 50_000;
const HEARTBEAT_MS = 20_000;
const MARKER_GRACE_MS = 2_500; // RingPane RECONNECT_MARKER_GRACE_MS

type Kinds = ProbeEntry['kind'];

/** First moment, at or after `from`, that the UI admitted a problem (any banner, header word, or divider). */
function firstAdmission(log: ProbeEntry[], from: number): { entry: ProbeEntry; ms: number } | null {
  const candidates = log
    .filter(
      (e) =>
        e.t >= from &&
        (e.kind === 'banner+' ||
          e.kind === 'header-reconnecting+' ||
          e.kind === 'console-reconnecting+' ||
          (e.kind === 'marker' && /^connection lost/.test(e.detail ?? '')))
    )
    .sort((a, b) => a.t - b.t);
  const entry = candidates[0];
  return entry ? { entry, ms: entry.t - from } : null;
}

function firstRowAfter(log: ProbeEntry[], from: number): number | null {
  const e = after(log, from, 'row');
  return e ? e.t - from : null;
}

function describeAdmissions(log: ProbeEntry[], from: number): string {
  return (
    log
      .filter((e) => e.t >= from && e.kind !== 'row')
      .map((e) => `${e.kind}${e.detail ? `(${e.detail})` : ''}@+${Math.round(e.t - from)}ms`)
      .join(' ') || 'nothing'
  );
}

function bannerShownFor(log: ProbeEntry[], from: number): number | null {
  const on = log.find((e) => e.t >= from && e.kind === 'banner+');
  if (!on) return null;
  const off = log.find((e) => e.t >= on.t && e.kind === 'banner-');
  return off ? off.t - on.t : null;
}

/**
 * The moment the app itself decided the connection was lost (`conn.lost` mark, same fake clock),
 * relative to `from`. The DOM probe can miss it: on the lab's zero-latency link the resubscribe
 * answers within the same React commit, so the banner may exist for a few milliseconds only.
 */
function lostAfter(snap: { marks: Record<string, number> }, from: number): number | null {
  const at = snap.marks['conn.lost'];
  return at === undefined || at < from ? null : at - from;
}

/**
 * Advance until the watchdog trips: coarse steps while it cannot have, fine ones near the
 * earliest it could (the best phase trips ~31 s after the fault). The trip time itself comes from
 * the app's own `conn.lost` mark, so the stepping only decides how long the test waits.
 */
async function waitForTrip(page: Page, maxMs = 90_000, coarseMs = 28_000): Promise<{ met: boolean }> {
  await advance(page, coarseMs, { stepMs: 2_000, until: (s) => (s.counters['conn.lost.watchdog'] ?? 0) >= 1 });
  return advance(page, maxMs - coarseMs, { stepMs: 250, until: (s) => (s.counters['conn.lost.watchdog'] ?? 0) >= 1 });
}

const watchdogTripped = (s: { counters: Record<string, number> }) => (s.counters['conn.lost.watchdog'] ?? 0) >= 1;

/**
 * Let the load settle (the first-load "reconnected" divider's grace period passes) and put a live
 * event row at the tail of the feed, which is what a room in use looks like. Without a live
 * row the tail is a divider, and the Ring never draws two dividers in a row.
 */
async function liveTail(page: Page): Promise<void> {
  await advance(page, 3_000, { stepMs: 1_000 });
  await lab(page, 'push', 3);
  await advance(page, 500, { stepMs: 250 });
}

async function settleThenAudit(page: Page, name: string, prefix: string, flushMs = MARKER_GRACE_MS + 1_000): Promise<Audit> {
  await lab(page, 'pause');
  await advance(page, flushMs, { stepMs: 500 });
  const a = await audit(page, name);
  recordAudit(prefix, a);
  return a;
}

/** Soft invariants every scenario shares. */
function expectNoLossNoDup(a: Audit): void {
  expect.soft(a.lost, 'events published but not rendered').toBe(0);
  expect.soft(a.duplicated, 'rows rendered more than once').toBe(0);
  expect.soft(a.order, 'rendered order matches publish order').toBe('ok');
}

test.describe('connection scenarios', () => {
  test.describe.configure({ mode: 'parallel' });

  // ─────────────────────────────────────────────────────────────────────────────────────
  test('1. clean drop during play, instant recovery', async ({ page }) => {
    await openClocked(page, FIXTURE, { history: HISTORY });
    await installProbe(page);
    await advance(page, 3_000, { stepMs: 500 });
    await lab(page, 'play', { speed: 4 });
    await advance(page, 6_000, { stepMs: 500 });

    const logBefore = (await lab<unknown[]>(page, 'connectionLog')).length;
    const published0 = await lab<number>(page, 'published');
    const faultAt = await clockNow(page);
    await lab(page, 'drop');
    await advance(page, 6_000, { stepMs: 50 });

    const log = await probeLog(page);
    const notice = firstAdmission(log, faultAt);
    const row = firstRowAfter(log, faultAt);
    const conn = (await lab<Array<{ kind: string }>>(page, 'connectionLog')).slice(logBefore);
    measure('drop.notice', notice?.ms ?? -1, 'ms');
    measure('drop.lostMark', lostAfter(await snapshot(page), faultAt) ?? -1, 'ms');
    measure('drop.firstRowAfterFault', row ?? -1, 'ms');
    measure('drop.bannerShownFor', bannerShownFor(log, faultAt) ?? -1, 'ms');
    measure('drop.resubscribes', conn.filter((c) => c.kind === 'subscribe').length, '');
    const t = (await snapshot(page)).durations;
    measure('drop.conn.reconnect', t['conn.reconnect'] ?? -1, 'ms');
    note(`published during test: ${published0} -> ${await lab(page, 'published')}; saw: ${describeAdmissions(log, faultAt)}`);

    const a = await settleThenAudit(page, FIXTURE, 'drop');
    expectNoLossNoDup(a);
    expect.soft(a.markers.map((m) => m.text), 'dividers after a clean drop').toEqual(['you joined here', 'connection lost', 'reconnected']);
  });

  // ─────────────────────────────────────────────────────────────────────────────────────
  test('2. outage of 5 s with 20 events published meanwhile', async ({ page }) => {
    await openClocked(page, FIXTURE, { history: HISTORY });
    await installProbe(page);
    await liveTail(page);

    const offset = await clockOffset(page);
    const logBefore = (await lab<unknown[]>(page, 'connectionLog')).length;
    const faultAt = await clockNow(page);
    await lab(page, 'drop', { downMs: 5_000 });
    await advance(page, 1_000, { stepMs: 50 });
    await lab(page, 'push', 20);
    const publishedAt = await clockNow(page);
    await advance(page, 7_000, { stepMs: 50 });

    const log = await probeLog(page);
    const conn = (await lab<Array<{ kind: string; at: number }>>(page, 'connectionLog')).slice(logBefore);
    const attempts = conn.filter((c) => c.kind === 'subscribe');
    const gaps = attempts.slice(1).map((c, i) => c.at - attempts[i]!.at);
    const handshake = conn.find((c) => c.kind === 'handshake');
    const restoredAt = handshake ? handshake.at - offset : null;
    const rowAfterRestore = restoredAt === null ? null : log.find((e) => e.t >= restoredAt && e.kind === 'row');

    measure('outage.notice', firstAdmission(log, faultAt)?.ms ?? -1, 'ms');
    measure('outage.attempts', attempts.length, '');
    measure('outage.attemptGap.min', gaps.length ? Math.min(...gaps) : -1, 'ms');
    measure('outage.attemptGap.max', gaps.length ? Math.max(...gaps) : -1, 'ms');
    measure('outage.linkRestoredAfter', restoredAt === null ? -1 : restoredAt - faultAt, 'ms');
    measure('outage.firstRowAfterRestore', rowAfterRestore && restoredAt !== null ? rowAfterRestore.t - restoredAt : -1, 'ms');
    measure('outage.bannerShownFor', bannerShownFor(log, faultAt) ?? -1, 'ms');
    note(
      `attempt gaps (ms, first 8): ${gaps.slice(0, 8).join(',')}; saw: ${describeAdmissions(log, faultAt)}; events pushed at +${Math.round(publishedAt - faultAt)}ms`
    );
    // No backoff would be 50 ms apart (the lab's fail delay); a backoff would grow.
    note(`backoff? ${gaps.length > 3 && gaps[gaps.length - 1]! > gaps[0]! * 2 ? 'grows' : 'none (constant)'}`);

    const a = await settleThenAudit(page, FIXTURE, 'outage');
    expectNoLossNoDup(a);
  });

  // ─────────────────────────────────────────────────────────────────────────────────────
  for (const phase of [
    { id: '3a', title: 'stall just after a heartbeat (worst phase)', stallAfterHeartbeatMs: 1_000 },
    { id: '3b', title: 'stall just before the next heartbeat (best phase)', stallAfterHeartbeatMs: 19_000 },
  ]) {
    test(`${phase.id}. silent stall, 15 events published, nothing else (${phase.title})`, async ({ page }) => {
      await openClocked(page, FIXTURE, { history: HISTORY });
      await installProbe(page);
      await liveTail(page);
      // Run until the first heartbeat frame has been delivered, then wait to the chosen phase.
      await advance(page, 30_000, { stepMs: 500, until: (s) => (s.counters['conn.heartbeat'] ?? 0) >= 1 });
      await advance(page, phase.stallAfterHeartbeatMs, { stepMs: 500 });

      // A 300 ms link, so the banner that the resubscribe raises lives for a round trip (on the
      // lab's default zero-latency link it would exist for a few milliseconds only).
      if (phase.id === '3a') await lab(page, 'setLatency', 300);
      const before = await snapshot(page);
      const publishedBefore = ringEventsPublishedSoFar(FIXTURE, await lab<number>(page, 'published')).length;
      const faultAt = await clockNow(page);
      await lab(page, 'stall');
      await lab(page, 'push', 15);
      const publishedDuring = ringEventsPublishedSoFar(FIXTURE, await lab<number>(page, 'published')).length - publishedBefore;

      const r = await waitForTrip(page);
      const mid = await snapshot(page);
      const log = await probeLog(page);
      const domNotice = firstAdmission(log, faultAt);
      const notice = { ms: lostAfter(mid, faultAt) ?? -1 };
      measure('stall.notice', notice.ms, 'ms');
      measure('stall.domNotice', domNotice?.ms ?? -1, 'ms');
      measure('stall.conn.gap_before_lost', mid.durations['conn.gap_before_lost'] ?? -1, 'ms');
      measure('stall.watchdogCount', mid.counters['conn.lost.watchdog'] ?? 0, '');
      measure('stall.visibilityResets', mid.counters['conn.visibility.reset'] ?? 0, '');
      measure('stall.lastFrameToStall', WATCHDOG_MS - notice.ms, 'ms');
      const rowsDuringSilence = log.filter((e) => e.t >= faultAt && e.t < faultAt + notice.ms - 1 && e.kind === 'row').length;
      measure('stall.rowsShownWhileSilent', rowsDuringSilence, '');
      note(
        `heartbeats before stall=${before.counters['conn.heartbeat']}; ${publishedDuring} renderable events published during the stall; DOM timeline up to the notice: ${describeAdmissions(log.filter((e) => e.t < faultAt + notice.ms - 1), faultAt)}`
      );

      // Catch-up: the resubscribe happens in the same tick as the notice.
      await advance(page, 3_000, { stepMs: 50 });
      const log2 = await probeLog(page);
      const noticeAt = faultAt + notice.ms;
      measure('stall.firstRowAfterNotice', firstRowAfter(log2, noticeAt) ?? -1, 'ms');
      measure('stall.firstRowAfterFault', firstRowAfter(log2, faultAt) ?? -1, 'ms');
      measure('stall.bannerShownFor', bannerShownFor(log2, faultAt) ?? -1, 'ms');
      note(`full timeline: ${describeAdmissions(log2, faultAt)}`);

      const a = await settleThenAudit(page, FIXTURE, 'stall');
      expectNoLossNoDup(a);
      // Accuracy of the "connection lost" divider: it should sit where the feed went quiet and
      // the events that happened during the silence should land between it and "reconnected".
      const between = eventRowsBetween(a, 'connection lost', 'reconnected');
      measure('stall.eventsBetweenMarkers', between, '');
      note(
        `markers=${JSON.stringify(a.markers)}; events between 'connection lost' and 'reconnected'=${between} (published during stall: ${publishedDuring}); the loss was noticed ${Math.round(notice.ms / 1000)}s after the fault`
      );
      expect.soft(between, 'events published during the silence sit between the dividers').toBe(publishedDuring);
      expect.soft(notice.ms, 'noticed within the documented watchdog').toBeLessThanOrEqual(WATCHDOG_MS + 1_000);
      expect.soft(notice.ms, 'noticed at all').toBeGreaterThan(0);
      expect.soft(r.met, 'the app noticed at all').toBe(true);
    });
  }

  test('3c. silent stall in a quiet feed (the tail is a divider): is the loss shown in the feed?', async ({ page }) => {
    await openClocked(page, FIXTURE, { history: HISTORY });
    await installProbe(page);
    await advance(page, 3_000, { stepMs: 500 }); // the feed's tail is "you joined here"
    const faultAt = await clockNow(page);
    await lab(page, 'stall');
    await lab(page, 'push', 15);
    await waitForTrip(page);
    const notice = lostAfter(await snapshot(page), faultAt) ?? -1;
    await advance(page, 4_000, { stepMs: 100 });
    measure('quietStall.notice', notice, 'ms');
    const a = await settleThenAudit(page, FIXTURE, 'quietStall');
    const dividers = a.markers.map((m) => m.text);
    note(`dividers: ${JSON.stringify(dividers)} (the 'connection lost' divider is skipped when the tail is already a divider)`);
    measure('quietStall.lostDividerDrawn', dividers.includes('connection lost') ? 1 : 0, '');
    expectNoLossNoDup(a);
    expect.soft(dividers, 'a loss that is later followed by "reconnected" has a matching "connection lost"').toContain('connection lost');
  });

  // ─────────────────────────────────────────────────────────────────────────────────────
  test('4a. silent stall, page hidden 30 s, then visible', async ({ page }) => {
    await openClocked(page, FIXTURE, { history: HISTORY });
    await installProbe(page);
    await liveTail(page);
    await lab(page, 'stall');
    await advance(page, 1_000, { stepMs: 500 });
    await setVisibility(page, 'hidden');
    await advance(page, 30_000, { stepMs: 1_000 });
    await lab(page, 'push', 10);
    const midLog = await probeLog(page);
    const visibleAt = await clockNow(page);
    await setVisibility(page, 'visible');
    const r = await waitForTrip(page);
    const snap = await snapshot(page);
    const notice = { ms: lostAfter(snap, visibleAt) ?? -1 };
    await advance(page, 3_000, { stepMs: 50 });
    const log2 = await probeLog(page);
    measure('hidden30.admittedWhileHidden', firstAdmission(midLog, 0) ? 1 : 0, '');
    measure('hidden30.lostMarkedWhileHidden', snap.marks['conn.lost'] !== undefined && snap.marks['conn.lost'] < visibleAt ? 1 : 0, '');
    measure('hidden30.visibleToNotice', notice.ms, 'ms');
    measure('hidden30.visibleToFirstRow', firstRowAfter(log2, visibleAt) ?? -1, 'ms');
    measure('hidden30.visibilityResets', snap.counters['conn.visibility.reset'] ?? 0, '');
    measure('hidden30.gap_before_lost', snap.durations['conn.gap_before_lost'] ?? -1, 'ms');
    note(`saw after visible: ${describeAdmissions(log2, visibleAt)}`);
    const a = await settleThenAudit(page, FIXTURE, 'hidden30');
    expectNoLossNoDup(a);
    expect.soft(r.met).toBe(true);
    expect.soft(notice.ms).toBeLessThanOrEqual(WATCHDOG_MS + 1_000);
  });

  test('4b. silent stall, page hidden 5 minutes (timers keep running, throttled), then visible', async ({ page }) => {
    await openClocked(page, FIXTURE, { history: HISTORY });
    await installProbe(page);
    await liveTail(page);
    await lab(page, 'stall');
    await lab(page, 'push', 10);
    await setVisibility(page, 'hidden');
    const hiddenAt = await clockNow(page);
    await advance(page, 300_000, { stepMs: 5_000 });
    const visibleAt = await clockNow(page);
    const hiddenLog = await probeLog(page);
    const beforeVisible = await snapshot(page);
    const noticeWhileHidden = lostAfter(beforeVisible, hiddenAt);
    await setVisibility(page, 'visible');
    await advance(page, 5_000, { stepMs: 100 });
    const log = await probeLog(page);
    const snap = await snapshot(page);
    measure('hidden5m.noticedAfterHide', noticeWhileHidden ?? -1, 'ms');
    measure('hidden5m.rowsCaughtUpBeforeVisible', hiddenLog.filter((e) => e.kind === 'row' && e.t > hiddenAt).length, '');
    measure('hidden5m.visibleToFirstRow', firstRowAfter(log, visibleAt) ?? -1, 'ms');
    measure('hidden5m.watchdogCount', snap.counters['conn.lost.watchdog'] ?? 0, '');
    note(`while hidden: ${describeAdmissions(hiddenLog, hiddenAt)}; after visible: ${describeAdmissions(log, visibleAt)}`);
    const a = await settleThenAudit(page, FIXTURE, 'hidden5m');
    expectNoLossNoDup(a);
  });

  for (const order of ['visibility-first', 'timers-first'] as const) {
    test(`4c. silent stall, page frozen 5 minutes then thawed (${order})`, async ({ page }) => {
      /*
       * A locked phone freezes the page: no timer fires while frozen, and whatever came due
       * fires on thaw. Playwright's `fastForward` is exactly that jump (due timers fire once).
       * Which of "visibilitychange" and "the overdue watchdog timer" runs first on thaw is up to
       * the browser, so both orders are measured.
       */
      await openClocked(page, FIXTURE, { history: HISTORY });
      await installProbe(page);
      await liveTail(page);
      await lab(page, 'stall');
      await setVisibility(page, 'hidden');
      await lab(page, 'push', 10);
      const thawAt = await clockNow(page);
      if (order === 'visibility-first') {
        await setVisibility(page, 'visible');
        await page.clock.fastForward(300_000);
      } else {
        await page.clock.fastForward(300_000);
        await flush(page);
        await setVisibility(page, 'visible');
      }
      await advance(page, 5_000, { stepMs: 100 });
      const thawed = await clockNow(page);
      const log = await probeLog(page);
      const snap = await snapshot(page);
      // The fast-forward moves the clock 300 s; report relative to the thaw.
      const jump = 300_000;
      const lostAt = snap.marks['conn.lost'];
      measure('frozen.thawToNotice', lostAt === undefined ? -1 : lostAt - thawAt - jump, 'ms');
      measure('frozen.thawToFirstRow', after(log, thawAt, 'row') ? after(log, thawAt, 'row')!.t - thawAt - jump : -1, 'ms');
      measure('frozen.watchdogCount', snap.counters['conn.lost.watchdog'] ?? 0, '');
      measure('frozen.visibilityResets', snap.counters['conn.visibility.reset'] ?? 0, '');
      note(`order=${order}; after thaw (jump excluded): ${describeAdmissions(log, thawAt)}; clock now ${Math.round(thawed - thawAt)}ms after thaw point`);
      const a = await settleThenAudit(page, FIXTURE, 'frozen');
      expectNoLossNoDup(a);
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────────────
  test('5a. hidden 5 minutes with a HEALTHY connection (timers running): no false reconnecting', async ({ page }) => {
    await openClocked(page, FIXTURE, { history: HISTORY });
    await installProbe(page);
    await liveTail(page);
    await setVisibility(page, 'hidden');
    const hiddenAt = await clockNow(page);
    // Events keep arriving while hidden, like a live room.
    for (let i = 0; i < 10; i++) {
      await advance(page, 30_000, { stepMs: 5_000 });
      await lab(page, 'push', 2);
    }
    await setVisibility(page, 'visible');
    await advance(page, 4_000, { stepMs: 250 });
    const log = await probeLog(page);
    const snap = await snapshot(page);
    measure('healthy5m.watchdog', snap.counters['conn.lost.watchdog'] ?? 0, '');
    measure('healthy5m.resubscribes', (await lab<Array<{ kind: string }>>(page, 'connectionLog')).filter((c) => c.kind === 'subscribe').length, '');
    measure('healthy5m.heartbeats', snap.counters['conn.heartbeat'] ?? 0, '');
    note(`over ${Math.round(((await clockNow(page)) - hiddenAt) / 1000)}s; saw: ${describeAdmissions(log, hiddenAt)}`);
    expect.soft(snap.counters['conn.lost.watchdog'] ?? 0, 'no watchdog trip on a healthy connection').toBe(0);
    expect.soft(log.filter((e) => e.kind === 'banner+').length, 'no reconnecting banner').toBe(0);
    const a = await settleThenAudit(page, FIXTURE, 'healthy5m');
    expectNoLossNoDup(a);
    expect.soft(a.markers.map((m) => m.text), 'no dividers on a healthy connection').not.toContain('connection lost');
  });

  test('5b. frozen 5 minutes with a HEALTHY connection (thaw jump): false reconnecting?', async ({ page }) => {
    await openClocked(page, FIXTURE, { history: HISTORY });
    await installProbe(page);
    await liveTail(page);
    await setVisibility(page, 'hidden');
    const hiddenAt = await clockNow(page);
    await lab(page, 'push', 10);
    await page.clock.fastForward(300_000);
    await flush(page);
    await setVisibility(page, 'visible');
    await advance(page, 4_000, { stepMs: 250 });
    const log = await probeLog(page);
    const snap = await snapshot(page);
    measure('healthyFrozen.watchdog', snap.counters['conn.lost.watchdog'] ?? 0, '');
    measure('healthyFrozen.resubscribes', (await lab<Array<{ kind: string }>>(page, 'connectionLog')).filter((c) => c.kind === 'subscribe').length, '');
    note(`saw (jump excluded): ${describeAdmissions(log, hiddenAt)}`);
    const a = await settleThenAudit(page, FIXTURE, 'healthyFrozen');
    expectNoLossNoDup(a);
    // Pages that are frozen with a healthy socket and then thawed should not announce a loss.
    expect.soft(snap.counters['conn.lost.watchdog'] ?? 0, 'no false watchdog trip after a thaw').toBe(0);
  });

  // ─────────────────────────────────────────────────────────────────────────────────────
  test('6. offline then online with a stalled transport: does the app react?', async ({ page }) => {
    await openClocked(page, FIXTURE, { history: HISTORY });
    await installProbe(page);
    await liveTail(page);
    await page.evaluate(() => {
      const w = window as unknown as { __net: Array<{ type: string; t: number }> };
      w.__net = [];
      for (const type of ['offline', 'online']) window.addEventListener(type, () => w.__net.push({ type, t: performance.now() }));
    });
    await lab(page, 'stall');
    await lab(page, 'push', 8);
    const historyBefore = (await lab<Array<{ via: string }>>(page, 'deliveries')).filter((d) => d.via === 'history').length;
    const subsBefore = (await lab<Array<{ kind: string }>>(page, 'connectionLog')).filter((c) => c.kind === 'subscribe').length;
    const faultAt = await clockNow(page);

    await setOffline(page, true);
    const offlineAt = await clockNow(page);
    await advance(page, 5_000, { stepMs: 250 });
    const afterOffline = await probeLog(page);
    const onlineAt = await clockNow(page);
    await setOffline(page, false);
    await advance(page, 5_000, { stepMs: 250 });
    const afterOnline = await probeLog(page);
    const subsMid = (await lab<Array<{ kind: string }>>(page, 'connectionLog')).filter((c) => c.kind === 'subscribe').length;
    const net = await page.evaluate(() => (window as unknown as { __net: Array<{ type: string }> }).__net.map((n) => n.type));
    const historyMid = (await lab<Array<{ via: string }>>(page, 'deliveries')).filter((d) => d.via === 'history').length;

    measure('offline.browserEventsSeen', net.length, '');
    measure('offline.admittedWithin5sOfOffline', firstAdmission(afterOffline, offlineAt) ? 1 : 0, '');
    measure('offline.admittedWithin5sOfOnline', firstAdmission(afterOnline, onlineAt) ? 1 : 0, '');
    measure('offline.resubscribesOnEvents', subsMid - subsBefore, '');
    measure('offline.historyRefetchedOnOnline', historyMid - historyBefore, ' deliveries');

    // Then the watchdog is still the only thing that notices.
    const r = await waitForTrip(page);
    const log = await probeLog(page);
    measure('offline.faultToNotice', lostAfter(await snapshot(page), faultAt) ?? -1, 'ms');
    note(`browser events: ${net.join(',')}; onlineAt=+${Math.round(onlineAt - faultAt)}ms; saw: ${describeAdmissions(log, faultAt)}`);
    await advance(page, 3_000, { stepMs: 100 });
    const a = await settleThenAudit(page, FIXTURE, 'offline');
    expectNoLossNoDup(a);
    expect.soft(r.met).toBe(true);
  });

  // ─────────────────────────────────────────────────────────────────────────────────────
  test('7a. slow link (800 ms): fresh open then play, order and loss', async ({ page }) => {
    await openLab(page, FIXTURE, { history: HISTORY });
    await showSurface(page, 'The Ring');
    const t0 = Date.now();
    await reopenWithLatency(page, FIXTURE, 800, HISTORY);
    await showSurface(page, 'The Ring');
    await expect
      .poll(async () => (await snapshot(page)).durations['ring.time_to_first_rows'] ?? null, { timeout: 15_000, intervals: [50] })
      .not.toBeNull();
    const snap = await snapshot(page);
    measure('slow800.ring.time_to_first_rows', snap.durations['ring.time_to_first_rows'] ?? -1, 'ms');
    measure('slow800.console.time_to_first_rows', snap.durations['console.time_to_first_rows'] ?? -1, 'ms');
    measure('slow800.conn.time_to_first_handshake', snap.durations['conn.time_to_first_handshake'] ?? -1, 'ms');
    measure('slow800.latencyApplied', (await lab<{ latencyMs: number }>(page, 'state')).latencyMs, 'ms');

    // Publish-to-render latency of a live event.
    await installProbe(page);
    await page.waitForTimeout(1_500);
    const t = await clockNow(page);
    await lab(page, 'push', 1);
    await expect.poll(async () => firstRowAfter(await probeLog(page), t), { timeout: 8_000, intervals: [25] }).not.toBeNull();
    const row = firstRowAfter(await probeLog(page), t);
    measure('slow800.publishToRow', row ?? -1, 'ms');

    // Fast replay across the slow link.
    await lab(page, 'play', { speed: 16 });
    await page.waitForTimeout(8_000);
    await lab(page, 'pause');
    await page.waitForTimeout(2_500);
    const a = await audit(page, FIXTURE);
    recordAudit('slow800', a);
    note(`open to first Ring rows ${Math.round(snap.durations['ring.time_to_first_rows'] ?? -1)}ms; wall ${Date.now() - t0}ms`);
    expectNoLossNoDup(a);
  });

  test('7b. very slow link (3000 ms): what is on screen while history loads', async ({ page }) => {
    await openLab(page, FIXTURE, { history: HISTORY });
    await reopenWithLatency(page, FIXTURE, 3_000, HISTORY);
    await showSurface(page, 'The Ring');
    const samples: Array<{ at: number; ringWaiting: boolean; ringRows: number; consolePlaceholder: boolean; consoleRows: number; headerConnecting: boolean }> = [];
    const start = Date.now();
    let shot = false;
    for (;;) {
      const s = await page.evaluate(() => {
        const shown = (el: Element) => (el as HTMLElement).getClientRects().length > 0 && !(el as HTMLElement).closest('[hidden]');
        const ring = [...document.querySelectorAll('section[aria-label^="The Ring"]')].find(shown);
        const con = [...document.querySelectorAll('section[aria-label^="Your Console"]')].find(shown);
        return {
          ringWaiting: /Waiting for fight events/.test(ring?.textContent ?? ''),
          ringRows: ring?.querySelectorAll('li[data-event-at]').length ?? 0,
          consolePlaceholder: /Type a command below to start/.test(con?.textContent ?? ''),
          consoleRows: con?.querySelectorAll('li.event:not(.event-feed-empty)').length ?? 0,
          headerConnecting: /connecting…/.test(ring?.querySelector('.pane-header')?.textContent ?? ''),
        };
      });
      const at = Date.now() - start;
      samples.push({ at, ...s });
      if (!shot && at > 1_200) {
        shot = true;
        await test.info().attach('while-history-loads', { body: await page.screenshot(), contentType: 'image/png' });
      }
      if (s.ringRows > 0 || at > 12_000) break;
      await page.waitForTimeout(100);
    }
    const firstRow = samples.find((x) => x.ringRows > 0);
    const snap = await snapshot(page);
    measure('slow3000.wallToFirstRingRow', firstRow?.at ?? -1, 'ms');
    measure('slow3000.ring.time_to_first_rows', snap.durations['ring.time_to_first_rows'] ?? -1, 'ms');
    measure('slow3000.console.time_to_first_rows', snap.durations['console.time_to_first_rows'] ?? -1, 'ms');
    measure('slow3000.conn.time_to_first_handshake', snap.durations['conn.time_to_first_handshake'] ?? -1, 'ms');
    const waiting = samples.filter((x) => x.ringWaiting);
    const consoleEmpty = samples.filter((x) => x.consolePlaceholder);
    const connecting = samples.filter((x) => x.headerConnecting);
    measure('slow3000.ringWaitingLineShownFor', waiting.length ? waiting[waiting.length - 1]!.at - waiting[0]!.at : 0, 'ms');
    measure('slow3000.consoleEmptyHintShownFor', consoleEmpty.length ? consoleEmpty[consoleEmpty.length - 1]!.at - consoleEmpty[0]!.at : 0, 'ms');
    measure('slow3000.headerConnectingShownFor', connecting.length ? connecting[connecting.length - 1]!.at - connecting[0]!.at : 0, 'ms');
    note(
      `Ring: "Waiting for fight events…" line ${waiting.length ? 'shown' : 'NOT shown'}; Console: empty-state hint "Type a command below to start" ${consoleEmpty.length ? 'shown while its history was still loading' : 'not shown'}; header "connecting…" ${connecting.length ? 'shown' : 'not shown'}; first Ring row at ${firstRow?.at ?? 'never'}ms wall`
    );
    expect.soft(firstRow, 'rows appear after the link answers').toBeDefined();
  });

  // ─────────────────────────────────────────────────────────────────────────────────────
  for (const latency of [0, 150, 800]) {
    test(`8. first load, link latency ${latency} ms`, async ({ page }, info) => {
      const phone = info.project.name.includes('phone');
      let startedAt = Date.now();
      if (latency === 0) {
        // A real cold page load.
        startedAt = Date.now();
        await openLab(page, FIXTURE, { history: HISTORY });
      } else {
        await openLab(page, FIXTURE, { history: HISTORY });
        startedAt = Date.now();
        await reopenWithLatency(page, FIXTURE, latency, HISTORY);
      }
      // Wait for the Console's rows (the default surface on a phone) and the connection.
      await expect
        .poll(async () => (await snapshot(page)).durations['conn.time_to_first_handshake'] ?? null, { timeout: 20_000, intervals: [50] })
        .not.toBeNull();
      await expect
        .poll(async () => (await snapshot(page)).durations['console.time_to_first_rows'] ?? null, { timeout: 20_000, intervals: [50] })
        .not.toBeNull();
      await page.waitForTimeout(latency === 0 ? 300 : latency + 600);
      const beforeTab = await snapshot(page);
      const ringBeforeTab = beforeTab.durations['ring.time_to_first_rows'] ?? null;
      const handshakes = beforeTab.counters['conn.handshake'] ?? 0;
      measure(`load${latency}.conn.time_to_first_handshake`, beforeTab.durations['conn.time_to_first_handshake'] ?? -1, 'ms');
      measure(`load${latency}.console.time_to_first_rows`, beforeTab.durations['console.time_to_first_rows'] ?? -1, 'ms');
      measure(`load${latency}.handshakes`, handshakes, '');
      measure(`load${latency}.ring.time_to_first_rows.beforeTabShown`, ringBeforeTab ?? -1, 'ms');

      // Showing the Ring: on a phone this is where the user first sees it.
      const clickAt = Date.now();
      await showSurface(page, 'The Ring');
      await expect
        .poll(async () => (await snapshot(page)).durations['ring.time_to_first_rows'] ?? null, { timeout: 20_000, intervals: [25] })
        .not.toBeNull();
      const afterTab = await snapshot(page);
      const ringShownAfter = Date.now() - clickAt;
      measure(`load${latency}.ring.time_to_first_rows`, afterTab.durations['ring.time_to_first_rows'] ?? -1, 'ms');
      measure(`load${latency}.tabClickToRingRows`, ringShownAfter, 'ms');
      measure(`load${latency}.wallToRingRows`, Date.now() - startedAt, 'ms');
      note(
        `${phone ? 'phone' : 'desktop'}: Ring first rows recorded before its tab was shown: ${ringBeforeTab === null ? 'no' : 'yes'}; ` +
          `subscribe/handshake count at load: ${handshakes}; subs=${JSON.stringify((await lab<Array<{ kind: string }>>(page, 'connectionLog')).map((c) => c.kind))}`
      );
      if (latency <= 150) {
        // A room in use: a few events land just after the page opens. Nothing has dropped, yet
        // the second handshake (the cursor-seed resubscribe) arms the "reconnected" divider.
        await lab(page, 'push', 3);
        await page.waitForTimeout(3_300);
        const a = await audit(page, FIXTURE);
        const dividers = a.markers.map((m) => m.text);
        measure(`load${latency}.reconnectedDividerWithoutALoss`, dividers.includes('reconnected') && !dividers.includes('connection lost') ? 1 : 0, '');
        note(`dividers after a clean load with live events: ${JSON.stringify(dividers)}`);
      }
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────────────
  test('9a. burst after resume: 150 events missed during a stall', async ({ page }) => {
    await openClocked(page, 'brawl', { history: HISTORY });
    await installProbe(page);
    await liveTail(page);
    const faultAt = await clockNow(page);
    await lab(page, 'stall');
    await lab(page, 'push', 150);
    const expectedBefore = ringEventsPublishedSoFar('brawl', await lab<number>(page, 'published')).length;
    const r = await waitForTrip(page);
    const notice = { ms: lostAfter(await snapshot(page), faultAt) ?? -1 };
    await advance(page, 3_000, { stepMs: 50 });
    const log2 = await probeLog(page);
    const conn = await lab<Array<{ kind: string; replayed?: number }>>(page, 'connectionLog');
    const replayed = conn.filter((c) => c.kind === 'replay').map((c) => c.replayed ?? 0);
    const rowsAfter = log2.filter((e) => e.kind === 'row' && e.t >= faultAt + notice.ms);
    measure('burst150.notice', notice.ms, 'ms');
    measure('burst150.lastReplayCount', replayed[replayed.length - 1] ?? -1, ' frames');
    measure('burst150.noticeToLastNewRow', rowsAfter.length ? rowsAfter[rowsAfter.length - 1]!.t - (faultAt + notice.ms) : -1, 'ms');
    note(`replay frames per subscribe: ${replayed.join(',')}; expected renderable total ${expectedBefore}`);
    const a = await settleThenAudit(page, 'brawl', 'burst150');
    expectNoLossNoDup(a);
    expect.soft(r.met).toBe(true);
  });

  test('9b. burst over the lab replay cap (520 events missed): what is lost and what is said', async ({ page }) => {
    /*
     * The lab replays at most 500 events after a known cursor and, unlike the real server
     * (docs/architecture/events-prompts-and-replay.md: "Replays are capped; hitting the cap
     * yields a private `system.gap`"), says nothing when it truncates. Its `system.gap` frame is
     * only sent for a cursor older than the whole log, which the app can never hold. So a
     * `system.gap` cannot be produced from the lab's controls; this test records what the UI
     * does in the case the lab CAN produce, and the loss it measures belongs to the lab's
     * missing gap frame, not to the app. A real-server suite must repeat it.
     */
    await openClocked(page, 'long-session', { history: HISTORY });
    await installProbe(page);
    await liveTail(page);
    const faultAt = await clockNow(page);
    await lab(page, 'stall');
    await lab(page, 'push', 520);
    await waitForTrip(page);
    await advance(page, 4_000, { stepMs: 100 });
    const log = await probeLog(page);
    const conn = await lab<Array<{ kind: string; replayed?: number }>>(page, 'connectionLog');
    note(`replay frames per subscribe: ${conn.filter((c) => c.kind === 'replay').map((c) => c.replayed ?? 0).join(',')}; gap frames sent: ${conn.filter((c) => c.kind === 'gap').length}; saw: ${describeAdmissions(log, faultAt)}`);
    measure('burst600.gapFramesSent', conn.filter((c) => c.kind === 'gap').length, '');
    const a = await settleThenAudit(page, 'long-session', 'burst600');
    // Published 520 + history 60 + 2 s of nothing: the lab drops everything past 500 silently.
    note(`LAB ARTIFACT: lost=${a.lost} neverDelivered=${a.neverDelivered} (no gap frame, no marker for the hole)`);
    expect.soft(a.duplicated, 'rows rendered more than once').toBe(0);
  });

  // ─────────────────────────────────────────────────────────────────────────────────────
  test('10. two rapid drops in a row during play: duplicate safety', async ({ page }) => {
    await openClocked(page, FIXTURE, { history: HISTORY });
    await installProbe(page);
    await advance(page, 3_000, { stepMs: 500 });
    await lab(page, 'play', { speed: 4 });
    await advance(page, 5_000, { stepMs: 500 });
    const logBefore = (await lab<unknown[]>(page, 'connectionLog')).length;
    const faultAt = await clockNow(page);
    await lab(page, 'drop');
    await advance(page, 30, { stepMs: 10 });
    await lab(page, 'drop');
    await advance(page, 6_000, { stepMs: 50 });
    const log = await probeLog(page);
    const conn = (await lab<Array<{ kind: string }>>(page, 'connectionLog')).slice(logBefore);
    measure('drop2.resubscribes', conn.filter((c) => c.kind === 'subscribe').length, '');
    measure('drop2.notice', firstAdmission(log, faultAt)?.ms ?? -1, 'ms');
    const snap = await snapshot(page);
    measure('drop2.duplicate_dropped', snap.counters['ring.events.duplicate_dropped'] ?? 0, '');
    note(`saw: ${describeAdmissions(log, faultAt)}`);
    const a = await settleThenAudit(page, FIXTURE, 'drop2');
    expectNoLossNoDup(a);
    expect.soft(a.markers.filter((m) => m.text === 'connection lost').length, 'one divider pair per outage, not one per drop').toBeLessThanOrEqual(1);
  });
});

void HEARTBEAT_MS;

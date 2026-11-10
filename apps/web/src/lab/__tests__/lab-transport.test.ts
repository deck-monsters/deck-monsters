import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameEvent } from '@deck-monsters/server/types';
import {
  LabTransport,
  defaultHistoryCount,
  type LabFixture,
  type TrackedFrame,
} from '../lab-transport.js';

const ROOM = '00000000-0000-4000-8000-0000000001ab';
const VIEWER = '00000000-0000-4000-8000-0000000000aa';
const OTHER = '00000000-0000-4000-8000-0000000000bb';
const BASE = 1_700_000_000_000;

function ev(i: number, over: Partial<GameEvent> = {}): LabFixture['events'][number] {
  const id = `${BASE + i * 1000}-e${i}`;
  return {
    id,
    atMs: i * 1000,
    data: {
      id,
      roomId: ROOM,
      timestamp: BASE + i * 1000,
      type: 'announce',
      scope: 'public',
      text: `event ${i}`,
      payload: {},
      ...over,
    },
  };
}

function fixture(count = 10, mutate?: (events: LabFixture['events']) => void): LabFixture {
  const events = Array.from({ length: count }, (_, i) => ev(i));
  mutate?.(events);
  return { name: 't', viewerUserId: VIEWER, roomId: ROOM, events };
}

/** A sink that records frames and errors. */
function sink() {
  const frames: TrackedFrame[] = [];
  const errors: Error[] = [];
  return {
    frames,
    errors,
    next: (f: TrackedFrame) => frames.push(f),
    error: (e: Error) => errors.push(e),
    types: () => frames.map((f) => f.data.type),
    ids: () => frames.filter((f) => !['handshake', 'heartbeat', 'system.gap'].includes(f.data.type)).map((f) => f.id),
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(BASE));
});
afterEach(() => {
  vi.useRealTimers();
});

describe('history split', () => {
  it('defaults to 40% of the fixture, capped at 300', () => {
    expect(defaultHistoryCount(10)).toBe(4);
    expect(defaultHistoryCount(2000)).toBe(300);
    expect(new LabTransport(fixture(10)).published()).toBe(4);
  });

  it('publishes exactly historyCount events up front and keeps the rest pending', () => {
    const t = new LabTransport(fixture(10), { historyCount: 6 });
    expect(t.published()).toBe(6);
    expect(t.remaining()).toBe(4);
    expect(t.done()).toBe(false);
    expect(t.ringHistory().map((e) => e.id)).toEqual(fixture(10).events.slice(0, 6).map((e) => e.id));
  });

  it('clamps an oversized or negative historyCount', () => {
    expect(new LabTransport(fixture(5), { historyCount: 99 }).done()).toBe(true);
    expect(new LabTransport(fixture(5), { historyCount: -3 }).published()).toBe(0);
  });

  it('splits history by scope: ring gets public, console gets the viewer private events', () => {
    const f = fixture(6, (events) => {
      events[1] = ev(1, { scope: 'private', targetUserId: VIEWER });
      events[2] = ev(2, { scope: 'private', targetUserId: OTHER });
    });
    const t = new LabTransport(f, { historyCount: 6 });
    expect(t.ringHistory().map((e) => e.text)).toEqual(['event 0', 'event 3', 'event 4', 'event 5']);
    expect(t.consoleHistory().map((e) => e.text)).toEqual(['event 1']);
  });

  it('caps ring history at 500 and console history at 200 (newest kept)', () => {
    const t = new LabTransport(fixture(700), { historyCount: 700 });
    const ring = t.ringHistory();
    expect(ring).toHaveLength(500);
    expect(ring[499]!.text).toBe('event 699');
    const c = fixture(300, (events) => {
      for (let i = 0; i < events.length; i++) events[i] = ev(i, { scope: 'private', targetUserId: VIEWER });
    });
    expect(new LabTransport(c, { historyCount: 300 }).consoleHistory()).toHaveLength(200);
  });
});

describe('scheduling', () => {
  it('play() publishes pending events on the recorded schedule', () => {
    const t = new LabTransport(fixture(6), { historyCount: 2 });
    const s = sink();
    t.subscribe({}, s);
    s.frames.length = 0;
    t.play();
    expect(t.published()).toBe(2); // nothing before the first timer
    vi.advanceTimersByTime(999);
    expect(t.published()).toBe(2);
    vi.advanceTimersByTime(1);
    expect(t.published()).toBe(3);
    vi.advanceTimersByTime(2000);
    expect(t.published()).toBe(5);
    vi.advanceTimersByTime(1000);
    expect(t.done()).toBe(true);
    expect(s.ids()).toEqual(fixture(6).events.slice(2).map((e) => e.id));
  });

  it('speed divides the gaps', () => {
    const t = new LabTransport(fixture(6), { historyCount: 1 });
    t.play({ speed: 4 });
    vi.advanceTimersByTime(250);
    expect(t.published()).toBe(2);
    vi.advanceTimersByTime(500);
    expect(t.published()).toBe(4);
  });

  it('pause() stops publishing and play() resumes from where it stopped', () => {
    const t = new LabTransport(fixture(6), { historyCount: 1 });
    t.play();
    vi.advanceTimersByTime(1000);
    expect(t.published()).toBe(2);
    t.pause();
    vi.advanceTimersByTime(10_000);
    expect(t.published()).toBe(2);
    t.play();
    vi.advanceTimersByTime(1000);
    expect(t.published()).toBe(3);
  });

  it('events recorded at the same instant go out together', () => {
    const f = fixture(5, (events) => {
      events[3] = { ...events[3]!, atMs: events[2]!.atMs };
    });
    const t = new LabTransport(f, { historyCount: 2 });
    t.play();
    vi.advanceTimersByTime(0);
    expect(t.published()).toBe(2);
    vi.advanceTimersByTime(1000);
    expect(t.published()).toBe(4);
  });

  it('push(n) publishes n events in one tick and never more than remain', () => {
    const t = new LabTransport(fixture(10), { historyCount: 2 });
    const s = sink();
    t.subscribe({}, s);
    s.frames.length = 0;
    expect(t.push(5)).toBe(5);
    expect(s.frames).toHaveLength(5);
    expect(t.push(99)).toBe(3);
    expect(t.done()).toBe(true);
    expect(t.push(1)).toBe(0);
  });

  it('stops by itself when the fixture is exhausted', () => {
    const t = new LabTransport(fixture(3), { historyCount: 1 });
    t.play();
    vi.advanceTimersByTime(5000);
    expect(t.done()).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('subscribe and replay', () => {
  it('opens with a server-shaped handshake', () => {
    const t = new LabTransport(fixture(4), { historyCount: 2 });
    const s = sink();
    t.subscribe({}, s);
    const hs = s.frames[0]!;
    expect(hs.data.type).toBe('handshake');
    expect(hs.id).toBe(hs.data.id);
    expect(hs.data.scope).toBe('private');
    expect(hs.data.targetUserId).toBe(VIEWER);
    const p = hs.data.payload as Record<string, unknown>;
    expect(p['protocolVersion']).toBe(1);
    expect(p['yourUserId']).toBe(VIEWER);
    expect(typeof p['buildVersion']).toBe('string');
    expect(typeof p['serverTime']).toBe('string');
    expect(Object.keys(p['ringState'] as object).sort()).toEqual(
      ['contestants', 'inEncounter', 'monsterCount', 'nextBossSpawnAt', 'nextFightAt', 'nextMegaBossAt']
    );
  });

  it('with no cursor replays the newest 100 visible events after the handshake', () => {
    const t = new LabTransport(fixture(150, (e) => { e[149] = ev(149, { scope: 'private', targetUserId: OTHER }); }), {
      historyCount: 150,
    });
    const s = sink();
    t.subscribe({}, s);
    expect(s.frames[0]!.data.type).toBe('handshake');
    expect(s.ids()).toHaveLength(100);
    expect(s.ids()[99]).toBe(`${BASE + 148 * 1000}-e148`); // 149 is another user's private event
  });

  it('replays only events after a known cursor, in order, and then goes live', () => {
    const t = new LabTransport(fixture(10), { historyCount: 5 });
    const cursor = fixture(10).events[1]!.id;
    const s = sink();
    t.subscribe({ lastEventId: cursor }, s);
    expect(s.ids()).toEqual(fixture(10).events.slice(2, 5).map((e) => e.id));
    t.push(2);
    expect(s.ids().slice(3)).toEqual(fixture(10).events.slice(5, 7).map((e) => e.id));
    expect(t.connectionLog().map((e) => e.kind)).toEqual(['subscribe', 'handshake', 'replay']);
    expect(t.connectionLog()[2]).toMatchObject({ replayed: 3, lastEventId: cursor });
  });

  it('a cursor at the newest event replays nothing', () => {
    const t = new LabTransport(fixture(5), { historyCount: 5 });
    const s = sink();
    t.subscribe({ lastEventId: fixture(5).events[4]!.id }, s);
    expect(s.types()).toEqual(['handshake']);
  });

  it('an unknown cursor older than the log yields a system.gap, then everything newer', () => {
    const t = new LabTransport(fixture(5), { historyCount: 5 });
    const s = sink();
    t.subscribe({ lastEventId: `${BASE - 5000}-ancient` }, s);
    expect(s.types().slice(0, 2)).toEqual(['handshake', 'system.gap']);
    expect(s.frames[1]!.data.payload).toEqual({ reason: 'buffer_or_retention' });
    expect(s.ids()).toHaveLength(5);
    expect(t.connectionLog().some((e) => e.kind === 'gap')).toBe(true);
  });

  it('an unknown cursor inside the log range resolves by time with no gap', () => {
    const t = new LabTransport(fixture(5), { historyCount: 5 });
    const s = sink();
    t.subscribe({ lastEventId: `${BASE + 1500}-synthetic` }, s);
    expect(s.types()).not.toContain('system.gap');
    expect(s.ids()).toEqual(fixture(5).events.slice(2).map((e) => e.id));
  });

  it('never delivers another user\'s private events, live or replayed', () => {
    const f = fixture(6, (e) => { e[2] = ev(2, { scope: 'private', targetUserId: OTHER }); e[4] = ev(4, { scope: 'private', targetUserId: VIEWER }); });
    const t = new LabTransport(f, { historyCount: 3 });
    const s = sink();
    t.subscribe({}, s);
    t.push(3);
    const texts = s.frames.filter((x) => x.data.type === 'announce').map((x) => x.data.text);
    expect(texts).toEqual(['event 0', 'event 1', 'event 3', 'event 4', 'event 5']);
  });

  it('sends a heartbeat every 20 s and not while stalled', () => {
    const t = new LabTransport(fixture(2), { historyCount: 0 });
    const s = sink();
    t.subscribe({}, s);
    expect(s.types()).toEqual(['handshake']);
    vi.advanceTimersByTime(20_000);
    expect(s.types()).toEqual(['handshake', 'heartbeat']);
    vi.advanceTimersByTime(40_000);
    expect(s.types().filter((x) => x === 'heartbeat')).toHaveLength(3);
    t.stall();
    vi.advanceTimersByTime(60_000);
    expect(s.types().filter((x) => x === 'heartbeat')).toHaveLength(3);
  });

  it('unsubscribe stops delivery and clears the heartbeat', () => {
    const t = new LabTransport(fixture(4), { historyCount: 0 });
    const s = sink();
    const off = t.subscribe({}, s);
    expect(t.state().subscriptions).toBe(1);
    off();
    expect(t.state()).toMatchObject({ subscriptions: 0, connected: false });
    t.push(2);
    vi.advanceTimersByTime(60_000);
    expect(s.frames).toHaveLength(1);
    expect(t.connectionLog().at(-1)!.kind).toBe('unsubscribe');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('derives the handshake roster from the newest ring.state', () => {
    const f = fixture(3, (e) => {
      e[1] = ev(1, { type: 'ring.state', payload: { monsterCount: 2, inEncounter: true, nextFightAt: 5, nextBossSpawnAt: null, contestants: [{ name: 'a' }] } });
    });
    const t = new LabTransport(f, { historyCount: 3 });
    const s = sink();
    t.subscribe({}, s);
    expect((s.frames[0]!.data.payload as { ringState: { monsterCount: number } }).ringState.monsterCount).toBe(2);
  });
});

describe('drop', () => {
  it('errors the live subscription and accepts a resubscribe straight away', () => {
    const t = new LabTransport(fixture(8), { historyCount: 2 });
    const a = sink();
    t.subscribe({}, a);
    t.drop();
    expect(a.errors).toHaveLength(1);
    expect(t.state()).toMatchObject({ subscriptions: 0, down: false });
    t.push(3); // missed while disconnected
    const b = sink();
    t.subscribe({ lastEventId: a.ids().at(-1)! }, b);
    expect(b.ids()).toEqual(fixture(8).events.slice(2, 5).map((e) => e.id));
    expect(t.connectionLog().map((e) => e.kind)).toEqual([
      'subscribe', 'handshake', 'replay', 'drop', 'subscribe', 'handshake', 'replay',
    ]);
  });

  it('while down, subscribe attempts error and only succeed once downMs has passed', () => {
    const t = new LabTransport(fixture(4), { historyCount: 0, failDelayMs: 10 });
    const a = sink();
    t.subscribe({}, a);
    t.drop({ downMs: 1000 });
    expect(t.state().down).toBe(true);
    const b = sink();
    t.subscribe({}, b);
    expect(b.errors).toHaveLength(0);
    vi.advanceTimersByTime(10);
    expect(b.errors).toHaveLength(1);
    expect(b.frames).toHaveLength(0);
    expect(t.state().subscriptions).toBe(0);
    vi.advanceTimersByTime(1000);
    expect(t.state().down).toBe(false);
    const c = sink();
    t.subscribe({}, c);
    expect(c.types()[0]).toBe('handshake');
    expect(t.state()).toMatchObject({ connected: true, subscriptions: 1 });
  });

  it('unsubscribing a failing attempt cancels its error', () => {
    const t = new LabTransport(fixture(2), { historyCount: 0, failDelayMs: 10 });
    t.drop({ downMs: 1000 });
    const b = sink();
    const off = t.subscribe({}, b);
    off();
    vi.advanceTimersByTime(100);
    expect(b.errors).toHaveLength(0);
  });
});

describe('stall and resume', () => {
  it('stall delivers nothing but keeps events for replay; resume does not replay', () => {
    const t = new LabTransport(fixture(8), { historyCount: 2 });
    const s = sink();
    t.subscribe({}, s);
    const before = s.frames.length;
    t.stall();
    expect(t.state()).toMatchObject({ stalled: true, connected: true, subscriptions: 1 });
    t.push(3);
    expect(s.frames).toHaveLength(before);
    expect(t.published()).toBe(5);
    t.resume();
    expect(t.state().stalled).toBe(false);
    expect(s.frames).toHaveLength(before); // lost, exactly like a dead socket
    t.push(1);
    expect(s.frames).toHaveLength(before + 1); // live again from here on
    expect(s.ids().at(-1)).toBe(fixture(8).events[5]!.id);
  });

  it('only a resubscribe recovers the frames lost in a stall', () => {
    const t = new LabTransport(fixture(8), { historyCount: 2 });
    const a = sink();
    t.subscribe({}, a);
    const cursor = a.ids().at(-1)!;
    t.stall();
    t.push(3);
    t.resume();
    const b = sink();
    t.subscribe({ lastEventId: cursor }, b);
    expect(b.ids()).toEqual(fixture(8).events.slice(2, 5).map((e) => e.id));
  });

  it('a subscription opened during a stall is healthy', () => {
    const t = new LabTransport(fixture(4), { historyCount: 0 });
    const a = sink();
    t.subscribe({}, a);
    t.stall();
    const b = sink();
    t.subscribe({}, b);
    t.push(1);
    expect(b.ids()).toHaveLength(1);
    expect(a.ids()).toHaveLength(0);
    expect(t.state().stalled).toBe(true); // the old one is still deaf
    t.connectionLog();
    expect(t.connectionLog().filter((e) => e.kind === 'stall')).toHaveLength(1);
  });
});

describe('latency', () => {
  it('delays every frame by ms and keeps order', () => {
    const t = new LabTransport(fixture(6), { historyCount: 0 });
    t.setLatency(200);
    const s = sink();
    t.subscribe({}, s);
    expect(s.frames).toHaveLength(0);
    vi.advanceTimersByTime(199);
    expect(s.frames).toHaveLength(0);
    vi.advanceTimersByTime(1);
    expect(s.types()).toEqual(['handshake']);
    t.push(3);
    t.setLatency(0); // a faster setting must not overtake frames already queued
    t.push(1);
    vi.advanceTimersByTime(500);
    expect(s.ids()).toEqual(fixture(6).events.slice(0, 4).map((e) => e.id));
  });

  it('frames queued behind latency are lost when the socket stalls', () => {
    const t = new LabTransport(fixture(4), { historyCount: 0 });
    const s = sink();
    t.subscribe({}, s);
    t.setLatency(100);
    t.push(2);
    t.stall();
    vi.advanceTimersByTime(1000);
    expect(s.ids()).toHaveLength(0);
  });
});

describe('deliveredIds', () => {
  it('lists history and subscription deliveries in order, never synthetic frames', () => {
    const t = new LabTransport(fixture(6), { historyCount: 3 });
    t.ringHistory();
    const s = sink();
    t.subscribe({}, s); // handshake + replay of the 3 history events
    t.push(2);
    vi.advanceTimersByTime(20_000); // heartbeat
    const ids = fixture(6).events.map((e) => e.id);
    expect(t.deliveredIds()).toEqual([...ids.slice(0, 3), ...ids.slice(0, 3), ...ids.slice(3, 5)]);
    expect(t.deliveries().map((d) => d.via)).toEqual([
      'history', 'history', 'history', 'replay', 'replay', 'replay', 'live', 'live',
    ]);
  });

  it('does not count events a stalled or dropped subscription never received', () => {
    const t = new LabTransport(fixture(6), { historyCount: 0 });
    t.subscribe({}, sink());
    t.stall();
    t.push(2);
    expect(t.deliveredIds()).toEqual([]);
  });

  it('lab echoes are replayable and delivered but are not fixture ids', () => {
    const t = new LabTransport(fixture(3), { historyCount: 1 });
    const s = sink();
    t.subscribe({}, s);
    const echo = t.publishSynthetic({
      type: 'system', scope: 'private', targetUserId: VIEWER, text: 'look', payload: { consoleInput: true },
    });
    expect(s.frames.at(-1)!.id).toBe(echo.id);
    expect(t.published()).toBe(1);
    expect(t.deliveredIds()).toEqual([fixture(3).events[0]!.id]);
    expect(t.consoleHistory().map((e) => e.text)).toEqual(['look']);
  });
});

describe('dispose', () => {
  it('clears every timer', () => {
    const t = new LabTransport(fixture(6), { historyCount: 1 });
    t.subscribe({}, sink());
    t.play();
    t.drop({ downMs: 5000 });
    t.dispose();
    expect(vi.getTimerCount()).toBe(0);
  });
});

/**
 * The feed lab's scripted transport: a fake "server" that replays a recorded fixture to the
 * real room UI. Pure TypeScript (no React, no tRPC), so its scheduling, replay, and
 * connection-fault behaviour can be unit tested under jsdom with fake timers.
 *
 * What it imitates (packages/server/src/trpc/router.ts, `ringFeed`):
 *  - a subscription opens with a `handshake` frame, then replays what the client missed
 *    (after `lastEventId`, or the newest 100 visible events when there is no cursor), then
 *    goes live, with a `heartbeat` every 20 s;
 *  - a cursor the server cannot match yields a `system.gap` frame;
 *  - a dead connection loses its frames; only a fresh subscription recovers them.
 *
 * Time is controlled through `setTimeout`/`setInterval`/`Date.now` only, so vitest's fake
 * timers drive everything deterministically.
 */
import type { GameEvent } from '@deck-monsters/server/types';

export interface LabFixtureEvent {
  /** `<epochMs>-<suffix>`, as the server's ids are. */
  id: string;
  /** Milliseconds after the fixture's first event. */
  atMs: number;
  data: GameEvent;
}

export interface LabFixture {
  name: string;
  description?: string;
  viewerUserId: string;
  roomId: string;
  events: LabFixtureEvent[];
}

export type ConnectionLogKind =
  | 'subscribe'
  | 'unsubscribe'
  | 'handshake'
  | 'replay'
  | 'gap'
  | 'drop'
  | 'stall'
  | 'resume';

export interface ConnectionLogEntry {
  at: number;
  kind: ConnectionLogKind;
  lastEventId?: string;
  replayed?: number;
}

export interface LabState {
  fixture: string;
  published: number;
  remaining: number;
  connected: boolean;
  subscriptions: number;
  down: boolean;
  stalled: boolean;
  /** Extras beyond the minimal contract, for the control strip and for tests. */
  playing: boolean;
  speed: number;
  latencyMs: number;
}

export type DeliveryVia = 'history' | 'replay' | 'live';

/** A tracked `{ id, data }` frame, the shape `useSubscription`'s `onData` receives. */
export interface TrackedFrame {
  id: string;
  data: GameEvent;
}

export interface SubscriptionSink {
  next(frame: TrackedFrame): void;
  error(error: Error): void;
}

export interface SubscribeInput {
  roomId?: string;
  lastEventId?: string;
}

export interface TransportOptions {
  /** Heartbeat period. The server's is 20 s. */
  heartbeatMs?: number;
  /** How long a subscribe attempt made while the connection is "down" takes to fail. */
  failDelayMs?: number;
}

export const PROTOCOL_VERSION = 1;
/** The server's replay cap is not exported; this is its documented DB-fallback order of magnitude. */
const REPLAY_CAP = 500;
const FRESH_REPLAY = 100;
const RING_HISTORY_CAP = 500;
const CONSOLE_HISTORY_CAP = 200;

/** Leading epoch of an id, or null. Same rule as `utils/ring-feed-cursor.ts`. */
export function epochOf(id: string): number | null {
  const match = /^(\d+)/.exec(id);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

/** Default split: 40% of the fixture has "already happened", at most 300 events. */
export function defaultHistoryCount(total: number): number {
  return Math.min(Math.floor(total * 0.4), 300);
}

interface Sub {
  n: number;
  sink: SubscriptionSink;
  /** True from `stall()` until `resume()` or the subscription ends: frames are silently lost. */
  deaf: boolean;
  closed: boolean;
  heartbeat: ReturnType<typeof setInterval> | null;
  timers: Set<ReturnType<typeof setTimeout>>;
  /** Earliest time the next frame may be delivered, so a latency change cannot reorder frames. */
  notBefore: number;
}

interface LogEvent {
  data: GameEvent;
  id: string;
  /** Came from the fixture (counted by deliveredIds/published) rather than a lab echo. */
  fixture: boolean;
}

export class LabTransport {
  readonly fixture: LabFixture;
  private readonly heartbeatMs: number;
  private readonly failDelayMs: number;

  /** Everything published so far, fixture events and lab echoes, in order. */
  private log: LogEvent[] = [];
  /** Index into `fixture.events` of the next unpublished event. */
  private cursor = 0;
  private subs = new Set<Sub>();
  private subCounter = 0;
  private synthCounter = 0;
  private connLog: ConnectionLogEntry[] = [];
  private delivered: Array<{ id: string; via: DeliveryVia }> = [];
  private latencyMs = 0;
  private down = false;
  private downTimer: ReturnType<typeof setTimeout> | null = null;
  private playTimer: ReturnType<typeof setTimeout> | null = null;
  private playing = false;
  private speed = 1;
  private disposed = false;
  private historyCalls = { ring: 0, console: 0 };
  private readonly fixtureIds: Set<string>;

  constructor(fixture: LabFixture, opts: { historyCount?: number } & TransportOptions = {}) {
    this.fixture = fixture;
    this.heartbeatMs = opts.heartbeatMs ?? 20_000;
    this.failDelayMs = opts.failDelayMs ?? 50;
    this.fixtureIds = new Set(fixture.events.map((e) => e.id));
    const total = fixture.events.length;
    const requested = opts.historyCount ?? defaultHistoryCount(total);
    const history = Math.max(0, Math.min(Math.floor(requested), total));
    for (let i = 0; i < history; i++) this.publishNext();
  }

  // ── Publishing ────────────────────────────────────────────────────────────────────

  published(): number {
    return this.cursor;
  }

  remaining(): number {
    return this.fixture.events.length - this.cursor;
  }

  done(): boolean {
    return this.remaining() === 0;
  }

  private visibleToViewer(event: GameEvent): boolean {
    return event.scope === 'public' || event.targetUserId === this.fixture.viewerUserId;
  }

  /** Publish the next fixture event: record it for replay and deliver it live. */
  private publishNext(): boolean {
    const next = this.fixture.events[this.cursor];
    if (!next) return false;
    this.cursor += 1;
    this.log.push({ data: next.data, id: next.id, fixture: true });
    this.deliverLive(next.id, next.data);
    return true;
  }

  private deliverLive(id: string, data: GameEvent): void {
    if (!this.visibleToViewer(data)) return;
    for (const sub of [...this.subs]) this.send(sub, { id, data }, 'live');
  }

  /** Publish the next `n` events in one tick (a burst). Returns how many were published. */
  push(n: number): number {
    let count = 0;
    for (let i = 0; i < n; i++) {
      if (!this.publishNext()) break;
      count += 1;
    }
    if (this.playing) this.schedule();
    return count;
  }

  play(opts: { speed?: number } = {}): void {
    if (opts.speed !== undefined && opts.speed > 0) this.speed = opts.speed;
    this.playing = true;
    this.schedule();
  }

  pause(): void {
    this.playing = false;
    if (this.playTimer !== null) clearTimeout(this.playTimer);
    this.playTimer = null;
  }

  isPlaying(): boolean {
    return this.playing;
  }

  /**
   * Arm one timer for the next pending event: the gap between its `atMs` and the previously
   * published fixture event's, divided by speed. Events sharing an `atMs` go out together.
   */
  private schedule(): void {
    if (this.playTimer !== null) clearTimeout(this.playTimer);
    this.playTimer = null;
    if (!this.playing || this.disposed) return;
    const next = this.fixture.events[this.cursor];
    if (!next) {
      this.playing = false;
      return;
    }
    const prev = this.cursor > 0 ? this.fixture.events[this.cursor - 1] : undefined;
    const gap = Math.max(0, next.atMs - (prev?.atMs ?? next.atMs));
    this.playTimer = setTimeout(() => {
      this.playTimer = null;
      if (!this.playing || this.disposed) return;
      this.publishNext();
      // Same-instant events (a card's lines recorded in one tick) go out in one burst.
      let upcoming = this.fixture.events[this.cursor];
      const base = next.atMs;
      while (upcoming && upcoming.atMs <= base) {
        this.publishNext();
        upcoming = this.fixture.events[this.cursor];
      }
      this.schedule();
    }, gap / this.speed);
  }

  /**
   * Publish an event of the lab's own (the console echo of a command). It joins the replay
   * log but is not a fixture event: it does not count toward published()/remaining() and is
   * not listed by deliveredIds().
   */
  publishSynthetic(data: Omit<GameEvent, 'id' | 'roomId' | 'timestamp'>): GameEvent {
    const last = this.log[this.log.length - 1];
    const epoch = (last && epochOf(last.id)) ?? Date.now();
    this.synthCounter += 1;
    const id = `${epoch}-lab-echo-${this.synthCounter}`;
    const event: GameEvent = { ...data, id, roomId: this.fixture.roomId, timestamp: epoch };
    this.log.push({ data: event, id, fixture: false });
    this.deliverLive(id, event);
    return event;
  }

  // ── History queries ───────────────────────────────────────────────────────────────

  /** `game.ringHistory`: public events published so far, oldest first, newest 500. */
  ringHistory(): GameEvent[] {
    this.historyCalls.ring += 1;
    const events = this.log.filter((e) => e.data.scope === 'public');
    return this.recordHistory(events.slice(-RING_HISTORY_CAP));
  }

  /** `game.consoleHistory`: this viewer's private events published so far, newest 200. */
  consoleHistory(): GameEvent[] {
    this.historyCalls.console += 1;
    const events = this.log.filter(
      (e) => e.data.scope === 'private' && e.data.targetUserId === this.fixture.viewerUserId
    );
    return this.recordHistory(events.slice(-CONSOLE_HISTORY_CAP));
  }

  /** How many times each history query has been answered (the lab's "UI has mounted" signal). */
  historyServed(): { ring: number; console: number } {
    return { ...this.historyCalls };
  }

  private recordHistory(events: LogEvent[]): GameEvent[] {
    for (const e of events) if (e.fixture) this.delivered.push({ id: e.id, via: 'history' });
    return events.map((e) => e.data);
  }

  /** The newest `ring.state` payload published so far, or a quiet ring. */
  ringStateSnapshot(): {
    nextFightAt: number | null;
    nextBossSpawnAt: number | null;
    nextMegaBossAt: number | null;
    monsterCount: number;
    inEncounter: boolean;
    contestants: unknown[];
  } {
    for (let i = this.log.length - 1; i >= 0; i--) {
      const entry = this.log[i]!;
      if (entry.data.type === 'ring.state') {
        const s = entry.data.payload as Record<string, unknown>;
        return {
          nextFightAt: (s['nextFightAt'] as number | null | undefined) ?? null,
          nextBossSpawnAt: (s['nextBossSpawnAt'] as number | null | undefined) ?? null,
          nextMegaBossAt: (s['nextMegaBossAt'] as number | null | undefined) ?? null,
          monsterCount: (s['monsterCount'] as number | undefined) ?? 0,
          inEncounter: Boolean(s['inEncounter']),
          contestants: Array.isArray(s['contestants']) ? (s['contestants'] as unknown[]) : [],
        };
      }
    }
    return {
      nextFightAt: null,
      nextBossSpawnAt: null,
      nextMegaBossAt: null,
      monsterCount: 0,
      inEncounter: false,
      contestants: [],
    };
  }

  // ── Subscription ──────────────────────────────────────────────────────────────────

  /** Time stamp for synthetic frames: stays on the fixture's timeline so cursors compare. */
  private timelineEpoch(): number {
    const last = this.log[this.log.length - 1];
    return (last && epochOf(last.id)) ?? Date.now();
  }

  private synthId(kind: string): string {
    this.synthCounter += 1;
    return `${this.timelineEpoch()}-${kind}-${this.synthCounter}`;
  }

  private synthEvent(
    kind: 'handshake' | 'heartbeat' | 'system.gap',
    extra: Partial<GameEvent> & { payload: Record<string, unknown> }
  ): TrackedFrame {
    const id = this.synthId(kind === 'system.gap' ? 'gap' : kind);
    const epoch = this.timelineEpoch();
    const data: GameEvent = {
      id,
      roomId: this.fixture.roomId,
      timestamp: epoch,
      type: kind as GameEvent['type'],
      scope: 'private',
      targetUserId: this.fixture.viewerUserId,
      text: '',
      ...extra,
    };
    return { id, data };
  }

  private entry(kind: ConnectionLogKind, extra: Partial<ConnectionLogEntry> = {}): void {
    this.connLog.push({ at: Date.now(), kind, ...extra });
  }

  /**
   * Open a `ringFeed` subscription. Returns the unsubscribe function. While the connection
   * is "down" the attempt fails (after `failDelayMs`, so a client that retries on error does
   * not spin).
   */
  subscribe(input: SubscribeInput, sink: SubscriptionSink): () => void {
    this.entry('subscribe', input.lastEventId !== undefined ? { lastEventId: input.lastEventId } : {});
    if (this.down || this.disposed) {
      const timer = setTimeout(() => sink.error(new Error('lab: connection is down')), this.failDelayMs);
      return () => clearTimeout(timer);
    }

    const sub: Sub = {
      n: ++this.subCounter,
      sink,
      deaf: false,
      closed: false,
      heartbeat: null,
      timers: new Set(),
      notBefore: 0,
    };
    this.subs.add(sub);
    sub.heartbeat = setInterval(() => {
      this.send(sub, this.synthEvent('heartbeat', { payload: {} }), 'live');
    }, this.heartbeatMs);

    // Handshake first, exactly as the server does.
    const rs = this.ringStateSnapshot();
    this.entry('handshake');
    this.send(
      sub,
      this.synthEvent('handshake', {
        payload: {
          protocolVersion: PROTOCOL_VERSION,
          buildVersion: (import.meta.env['VITE_BUILD_VERSION'] as string | undefined) ?? 'dev',
          serverTime: new Date().toISOString(),
          yourUserId: this.fixture.viewerUserId,
          ringState: rs,
        },
      }),
      'live'
    );

    // Then the replay.
    let replayed = 0;
    const replay = (events: LogEvent[]) => {
      for (const e of events) {
        if (!this.visibleToViewer(e.data)) continue;
        this.send(sub, { id: e.id, data: e.data }, 'replay');
        replayed += 1;
      }
    };
    if (input.lastEventId) {
      const index = this.log.findIndex((e) => e.id === input.lastEventId);
      if (index >= 0) {
        replay(this.log.slice(index + 1, index + 1 + REPLAY_CAP));
      } else {
        // Cursor the server's buffer does not hold. By time, like the DB fallback, when it
        // lies inside the published range; otherwise nothing matches and the server says so.
        const cursorEpoch = epochOf(input.lastEventId);
        const firstEpoch = this.log.length > 0 ? epochOf(this.log[0]!.id) : null;
        const known = cursorEpoch !== null && firstEpoch !== null && cursorEpoch >= firstEpoch;
        const missed =
          cursorEpoch === null
            ? this.log
            : this.log.filter((e) => (epochOf(e.id) ?? 0) > cursorEpoch);
        if (!known && this.log.length > 0) {
          this.entry('gap', { lastEventId: input.lastEventId });
          this.send(
            sub,
            this.synthEvent('system.gap', {
              text: '── Some events were missed while you were away. ──',
              payload: { reason: 'buffer_or_retention' },
            }),
            'live'
          );
        }
        replay(missed.slice(0, REPLAY_CAP));
      }
    } else {
      replay(this.log.filter((e) => this.visibleToViewer(e.data)).slice(-FRESH_REPLAY));
    }
    this.entry('replay', {
      replayed,
      ...(input.lastEventId !== undefined ? { lastEventId: input.lastEventId } : {}),
    });

    return () => this.closeSub(sub, true);
  }

  private closeSub(sub: Sub, log: boolean): void {
    if (sub.closed) return;
    sub.closed = true;
    this.subs.delete(sub);
    if (sub.heartbeat !== null) clearInterval(sub.heartbeat);
    for (const t of sub.timers) clearTimeout(t);
    sub.timers.clear();
    if (log) this.entry('unsubscribe');
  }

  /** Deliver one frame, through latency, unless the subscription is deaf or gone. */
  private send(sub: Sub, frame: TrackedFrame, via: DeliveryVia): void {
    const deliver = () => {
      if (sub.closed || sub.deaf) return;
      if (this.fixtureIds.has(frame.id)) this.delivered.push({ id: frame.id, via });
      sub.sink.next(frame);
    };
    if (sub.closed || sub.deaf) return;
    if (this.latencyMs <= 0 && sub.timers.size === 0) {
      deliver();
      return;
    }
    const at = Math.max(Date.now() + this.latencyMs, sub.notBefore);
    sub.notBefore = at;
    const timer = setTimeout(() => {
      sub.timers.delete(timer);
      deliver();
    }, at - Date.now());
    sub.timers.add(timer);
  }

  // ── Connection control ────────────────────────────────────────────────────────────

  /**
   * Error every live subscription (the client's `onError` path). New subscribe attempts fail
   * for `downMs`, then are accepted.
   */
  drop(opts: { downMs?: number } = {}): void {
    this.entry('drop');
    const downMs = opts.downMs ?? 0;
    if (this.downTimer !== null) clearTimeout(this.downTimer);
    this.downTimer = null;
    this.down = downMs > 0;
    if (this.down) {
      this.downTimer = setTimeout(() => {
        this.down = false;
        this.downTimer = null;
      }, downMs);
    }
    for (const sub of [...this.subs]) {
      this.closeSub(sub, false);
      sub.sink.error(new Error('lab: connection dropped'));
    }
  }

  /** A silent dead socket: every frame, heartbeats included, is lost without closing. */
  stall(): void {
    this.entry('stall');
    for (const sub of this.subs) {
      sub.deaf = true;
      // Frames already in the latency queue are lost with the socket.
      for (const t of sub.timers) clearTimeout(t);
      sub.timers.clear();
    }
  }

  /** End a stall WITHOUT replaying: only a resubscribe gets what was missed. */
  resume(): void {
    this.entry('resume');
    for (const sub of this.subs) sub.deaf = false;
  }

  setLatency(ms: number): void {
    this.latencyMs = Math.max(0, ms);
  }

  latency(): number {
    return this.latencyMs;
  }

  connectionLog(): ConnectionLogEntry[] {
    return this.connLog.map((e) => ({ ...e }));
  }

  deliveredIds(): string[] {
    return this.delivered.map((d) => d.id);
  }

  deliveries(): Array<{ id: string; via: DeliveryVia }> {
    return this.delivered.map((d) => ({ ...d }));
  }

  state(): LabState {
    const subscriptions = this.subs.size;
    return {
      fixture: this.fixture.name,
      published: this.published(),
      remaining: this.remaining(),
      connected: subscriptions > 0 && !this.down,
      subscriptions,
      down: this.down,
      stalled: [...this.subs].some((s) => s.deaf),
      playing: this.playing,
      speed: this.speed,
      latencyMs: this.latencyMs,
    };
  }

  /** Stop everything: timers, subscriptions. Used when the lab switches fixture. */
  dispose(): void {
    this.disposed = true;
    this.pause();
    if (this.downTimer !== null) clearTimeout(this.downTimer);
    this.downTimer = null;
    for (const sub of [...this.subs]) this.closeSub(sub, false);
  }
}

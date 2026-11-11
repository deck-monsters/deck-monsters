import { act, render, renderHook, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import type { GameEvent } from '@deck-monsters/server/types';
import { HEARTBEAT_INTERVAL_MS, RESUME_GRACE_MS } from '../utils/ring-feed-connection.js';
import {
  HEARTBEAT_TIMEOUT_MS,
  RingFeedContext,
  RingFeedProvider,
  useRingFeed,
  useRingFeedListener,
  type RingFeedApi,
  type TrackedRingFeedEvent,
} from '../hooks/useRingFeed.js';
import { useContext } from 'react';
import { feedTimings } from '../lib/feed-timings.js';

/** Reads the provider's live api object, including the connection flags. */
function useRingFeedContextForTest(): RingFeedApi {
  const ctx = useContext(RingFeedContext);
  if (!ctx) throw new Error('no RingFeedContext');
  return ctx;
}

type TrackedEvent = { id: string; data: GameEvent };

const subscriptionCalls: Array<{
  input: { roomId: string; lastEventId?: string; resumeAttempt?: number };
  onData?: (tracked: TrackedEvent) => void;
  onError?: () => void;
}> = [];

/** When set, the mock pushes this event via queueMicrotask on first subscribe (after layout). */
let earlyDeliverOnSubscribe: TrackedEvent | null = null;

/** The `status` the mocked `useSubscription` reports, like @trpc/react-query's. */
let subscriptionStatus: 'connecting' | 'pending' | 'error' = 'pending';

const handleHandshakeEvent = vi.fn();

vi.mock('../hooks/useHandshake.js', () => ({
  useHandshake: () => ({
    handshakeStatus: { status: 'pending' },
    handleHandshakeEvent,
  }),
}));

vi.mock('../lib/trpc.js', () => ({
  trpc: {
    game: {
      ringFeed: {
        useSubscription: (
          input: { roomId: string; lastEventId?: string; resumeAttempt?: number },
          opts: { onData?: (tracked: TrackedEvent) => void; onError?: () => void },
        ) => {
          subscriptionCalls.push({
            input: { ...input },
            onData: opts.onData,
            onError: opts.onError,
          });
          // Model early server push: fire after the current commit/layout so
          // useLayoutEffect listeners must already be registered to observe it
          // without relying on a later useEffect tick.
          if (earlyDeliverOnSubscribe && opts.onData) {
            const early = earlyDeliverOnSubscribe;
            earlyDeliverOnSubscribe = null;
            const onData = opts.onData;
            queueMicrotask(() => onData(early));
          }
          return { status: subscriptionStatus };
        },
      },
    },
  },
}));

function makeEvent(
  overrides: Partial<GameEvent> & Pick<GameEvent, 'id' | 'type'>,
): GameEvent {
  return {
    roomId: 'room-a',
    timestamp: Date.now(),
    scope: 'public',
    text: overrides.type,
    payload: {},
    ...overrides,
  };
}

function latestCall() {
  const call = subscriptionCalls[subscriptionCalls.length - 1];
  if (!call) throw new Error('no subscription call');
  return call;
}

function ListenerProbe({
  onEvent,
  label,
}: {
  onEvent: (tracked: TrackedRingFeedEvent) => void;
  label: string;
}) {
  useRingFeedListener(onEvent);
  return <div data-testid={label} />;
}

describe('useRingFeed', () => {
  beforeEach(() => {
    subscriptionCalls.length = 0;
    handleHandshakeEvent.mockReset();
    earlyDeliverOnSubscribe = null;
    subscriptionStatus = 'pending';
  });

  it('opens exactly one ringFeed subscription and fans out each event once', () => {
    const { result } = renderHook(() => useRingFeed('room-a'));

    expect(subscriptionCalls).toHaveLength(1);
    expect(latestCall().input).toEqual({ roomId: 'room-a', lastEventId: undefined, resumeAttempt: 0 });

    const ringHandler = vi.fn();
    const consoleHandler = vi.fn();

    act(() => {
      result.current.subscribe(ringHandler);
      result.current.subscribe(consoleHandler);
    });

    const tracked: TrackedEvent = {
      id: '100-evt',
      data: makeEvent({ id: '100-evt', type: 'ring.add', text: 'joined' }),
    };

    act(() => {
      latestCall().onData?.(tracked);
    });

    expect(ringHandler).toHaveBeenCalledTimes(1);
    expect(consoleHandler).toHaveBeenCalledTimes(1);
    expect(ringHandler).toHaveBeenCalledWith(tracked);
    expect(consoleHandler).toHaveBeenCalledWith(tracked);

    // The guard this test exists for (#63) is *one subscription*, not one call: the mock
    // records a call per render, and the first live frame legitimately flips `connected`
    // true, which renders. What must never happen is a second, distinct subscription —
    // real tRPC does not re-subscribe on an identical input.
    expect(new Set(subscriptionCalls.map((call) => JSON.stringify(call.input))).size).toBe(1);
  });

  it('registers layout listeners in time for early microtask subscription delivery', async () => {
    const earlyHandshake: TrackedEvent = {
      id: '1-handshake',
      data: makeEvent({
        id: '1-handshake',
        type: 'handshake',
        scope: 'private',
        payload: {
          protocolVersion: 1,
          buildVersion: 'dev',
          serverTime: new Date().toISOString(),
          yourUserId: 'u1',
          ringState: { nextFightAt: Date.now() + 60_000, nextBossSpawnAt: null, monsterCount: 1 },
        },
      }),
    };
    earlyDeliverOnSubscribe = earlyHandshake;

    const ringHandler = vi.fn();
    const consoleHandler = vi.fn();

    function Tree({ children }: { children: ReactNode }) {
      return <RingFeedProvider roomId="room-early">{children}</RingFeedProvider>;
    }

    render(
      <Tree>
        <ListenerProbe label="ring" onEvent={ringHandler} />
        <ListenerProbe label="console" onEvent={consoleHandler} />
      </Tree>,
    );

    expect(screen.getByTestId('ring')).toBeTruthy();
    expect(screen.getByTestId('console')).toBeTruthy();

    await act(async () => {
      await Promise.resolve();
    });

    expect(ringHandler).toHaveBeenCalled();
    expect(consoleHandler).toHaveBeenCalled();
    expect(ringHandler.mock.calls[0]?.[0].id).toBe('1-handshake');
    expect(consoleHandler.mock.calls[0]?.[0].id).toBe('1-handshake');
    expect(handleHandshakeEvent).toHaveBeenCalledTimes(1);
  });

  it('buffers events that arrive before any pane listener is registered', () => {
    const { result } = renderHook(() => useRingFeed('room-a'));
    const ringHandler = vi.fn();
    const consoleHandler = vi.fn();

    const early: TrackedEvent = {
      id: '5-handshake',
      data: makeEvent({
        id: '5-handshake',
        type: 'handshake',
        scope: 'private',
        payload: {
          protocolVersion: 1,
          buildVersion: 'dev',
          serverTime: new Date().toISOString(),
          yourUserId: 'u1',
        },
      }),
    };

    act(() => {
      latestCall().onData?.(early);
    });
    expect(ringHandler).not.toHaveBeenCalled();
    expect(handleHandshakeEvent).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.subscribe(ringHandler);
      result.current.subscribe(consoleHandler);
    });

    expect(ringHandler).toHaveBeenCalledTimes(1);
    expect(consoleHandler).toHaveBeenCalledTimes(1);
    expect(ringHandler.mock.calls[0]?.[0].id).toBe('5-handshake');
    expect(consoleHandler.mock.calls[0]?.[0].id).toBe('5-handshake');
  });

  it('excludes handshake and heartbeat from the shared reconnect cursor', () => {
    const { rerender } = renderHook(() => useRingFeed('room-a'));

    act(() => {
      latestCall().onData?.({
        id: '1-handshake',
        data: makeEvent({
          id: '1-handshake',
          type: 'handshake',
          scope: 'private',
          payload: {
            protocolVersion: 1,
            buildVersion: 'dev',
            serverTime: new Date().toISOString(),
            yourUserId: 'u1',
          },
        }),
      });
      latestCall().onData?.({
        id: '2-heartbeat',
        data: makeEvent({ id: '2-heartbeat', type: 'heartbeat', scope: 'private' }),
      });
    });

    expect(handleHandshakeEvent).toHaveBeenCalledTimes(1);

    act(() => {
      latestCall().onError?.();
    });
    rerender();

    expect(latestCall().input.lastEventId).toBeUndefined();

    act(() => {
      // The resumed subscription's handshake: what resets the backoff between losses.
      latestCall().onData?.({
        id: '4-handshake',
        data: makeEvent({ id: '4-handshake', type: 'handshake', scope: 'private' }),
      });
      latestCall().onData?.({
        id: '3-live',
        data: makeEvent({ id: '3-live', type: 'announce', text: 'hello' }),
      });
      latestCall().onError?.();
    });
    rerender();

    expect(latestCall().input.lastEventId).toBe('3-live');
  });

  it('ignores stale events from another room and resets cursor on room switch', () => {
    const { result, rerender } = renderHook(
      ({ roomId }) => useRingFeed(roomId),
      { initialProps: { roomId: 'room-a' } },
    );

    const listener = vi.fn();
    act(() => {
      result.current.subscribe(listener);
    });

    act(() => {
      latestCall().onData?.({
        id: '10-a',
        data: makeEvent({ id: '10-a', type: 'announce', roomId: 'room-a' }),
      });
      latestCall().onData?.({
        id: '11-b',
        data: makeEvent({ id: '11-b', type: 'announce', roomId: 'room-b' }),
      });
    });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0]?.[0].id).toBe('10-a');

    act(() => {
      latestCall().onError?.();
    });
    rerender({ roomId: 'room-a' });
    expect(latestCall().input.lastEventId).toBe('10-a');

    rerender({ roomId: 'room-b' });

    // resumeAttempt resets with the room, like the cursor and the watchdog.
    expect(latestCall().input).toEqual({ roomId: 'room-b', lastEventId: undefined, resumeAttempt: 0 });

    listener.mockClear();
    act(() => {
      result.current.subscribe(listener);
      latestCall().onData?.({
        id: '12-a-stale',
        data: makeEvent({ id: '12-a-stale', type: 'announce', roomId: 'room-a' }),
      });
      latestCall().onData?.({
        id: '13-b',
        data: makeEvent({ id: '13-b', type: 'announce', roomId: 'room-b' }),
      });
    });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0]?.[0].id).toBe('13-b');
  });

  it('advances the shared cursor monotonically, and only a loss puts it in the subscription input', () => {
    const { result, rerender } = renderHook(() => useRingFeed('room-a'));
    const lose = () => {
      act(() => {
        // A handshake first, so the backoff is back at its immediate first retry.
        latestCall().onData?.({
          id: `${Date.now()}-handshake`,
          data: makeEvent({ id: `${Date.now()}-handshake`, type: 'handshake', scope: 'private' }),
        });
        latestCall().onError?.();
      });
      rerender();
    };

    // History seeds advance the ref and nothing else: the input must not change, or every
    // page load subscribes twice (baseline C4).
    const before = subscriptionCalls.length;
    act(() => {
      result.current.seedCursor('100-ring-hist');
      result.current.seedCursor('200-console-hist');
    });
    rerender();
    expect(latestCall().input.lastEventId).toBeUndefined();
    expect(new Set(subscriptionCalls.slice(before).map((c) => JSON.stringify(c.input))).size).toBe(1);

    // older history cannot move the cursor backwards
    act(() => {
      result.current.seedCursor('150-older-hist');
    });
    lose();
    expect(latestCall().input.lastEventId).toBe('200-console-hist');

    // live newer than history advances the tracked cursor; older history cannot overwrite it
    act(() => {
      latestCall().onData?.({
        id: '300-live',
        data: makeEvent({ id: '300-live', type: 'announce' }),
      });
      result.current.seedCursor('250-stale-hist');
    });
    lose();
    expect(latestCall().input.lastEventId).toBe('300-live');

    // live older than current cursor does not rewind
    act(() => {
      latestCall().onData?.({
        id: '280-old-live',
        data: makeEvent({ id: '280-old-live', type: 'announce' }),
      });
    });
    lose();
    expect(latestCall().input.lastEventId).toBe('300-live');
  });

  it('subscribes once per page load even when history seeds the cursor (baseline C4)', () => {
    const { result } = renderHook(() => useRingFeed('room-a'));
    act(() => {
      latestCall().onData?.({ id: '1-handshake', data: makeEvent({ id: '1-handshake', type: 'handshake', scope: 'private' }) });
    });
    act(() => {
      result.current.seedCursor('500-history-tail');
    });
    expect(new Set(subscriptionCalls.map((c) => JSON.stringify(c.input))).size).toBe(1);
    expect(latestCall().input).toEqual({ roomId: 'room-a', lastEventId: undefined, resumeAttempt: 0 });
  });
});

describe('useRingFeed: heartbeat watchdog (#108)', () => {
  function wrapper({ children }: { children: ReactNode }) {
    return <RingFeedProvider roomId="room-a">{children}</RingFeedProvider>;
  }

  it('treats silence longer than the heartbeat timeout as a lost connection', () => {
    vi.useFakeTimers();
    try {
      const { result } = renderHook(() => useRingFeedContextForTest(), { wrapper });

      act(() => {
        latestCall().onData?.({ id: 'e1', data: makeEvent({ id: 'e1', type: 'handshake' }) });
      });
      expect(result.current.connected).toBe(true);

      act(() => {
        vi.advanceTimersByTime(HEARTBEAT_TIMEOUT_MS + 1_000);
      });

      // Nothing errored — the socket is simply silent, which is what a blackholing
      // network looks like. (A backgrounded phone looks the same but is not evidence of
      // anything; see the visibility tests below.)
      expect(result.current.connected).toBe(false);
      expect(result.current.reconnecting).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps the connection alive while heartbeats keep arriving', () => {
    vi.useFakeTimers();
    try {
      const { result } = renderHook(() => useRingFeedContextForTest(), { wrapper });

      act(() => {
        latestCall().onData?.({ id: 'e1', data: makeEvent({ id: 'e1', type: 'handshake' }) });
      });

      // Three intervals' worth of silence, broken by a heartbeat each time.
      for (let i = 0; i < 3; i += 1) {
        act(() => {
          vi.advanceTimersByTime(HEARTBEAT_TIMEOUT_MS - 5_000);
          latestCall().onData?.({
            id: `hb${i}`,
            data: makeEvent({ id: `hb${i}`, type: 'heartbeat' }),
          });
        });
      }

      expect(result.current.connected).toBe(true);
      expect(result.current.reconnecting).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('resumes from the last event it saw, not from the beginning', () => {
    vi.useFakeTimers();
    try {
      renderHook(() => useRingFeedContextForTest(), { wrapper });

      act(() => {
        latestCall().onData?.({ id: 'e1', data: makeEvent({ id: 'e1', type: 'handshake' }) });
        latestCall().onData?.({ id: '900-aaaa', data: makeEvent({ id: '900-aaaa', type: 'announce' }) });
      });

      act(() => {
        vi.advanceTimersByTime(HEARTBEAT_TIMEOUT_MS + 1_000);
      });

      expect(latestCall().input.lastEventId).toBe('900-aaaa');
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('useRingFeed: the watchdog belongs to its room (#108)', () => {
  function wrapper({ children }: { children: ReactNode }) {
    return <RingFeedProvider roomId="room-a">{children}</RingFeedProvider>;
  }

  it('does not let a previous room\'s watchdog drop the new room\'s connection', () => {
    // RingFeedProvider is not re-keyed per room, so a timer left armed across a switch
    // fires against the new room and strands a healthy feed in "reconnecting…", which
    // only a real handshake clears.
    vi.useFakeTimers();
    try {
      const { result, rerender } = renderHook(
        ({ roomId }: { roomId: string }) => {
          useRingFeed(roomId);
          return useRingFeedContextForTest();
        },
        {
          wrapper,
          initialProps: { roomId: 'room-a' },
        }
      );

      act(() => {
        latestCall().onData?.({ id: 'e1', data: makeEvent({ id: 'e1', type: 'handshake' }) });
      });

      // Switch rooms with the watchdog armed, then let the old timer's deadline pass.
      act(() => {
        rerender({ roomId: 'room-b' });
      });
      act(() => {
        vi.advanceTimersByTime(HEARTBEAT_TIMEOUT_MS + 1_000);
      });

      expect(result.current.reconnecting).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});

/**
 * The reporter saw "-- reconnecting --" on a console that was working fine, with no
 * "reconnected" line after it. Two separate defects produced that, and both are covered
 * here. See 10b-bugs-fixed.md #127.
 */
describe('useRingFeed: recovering from a watchdog trip', () => {
  function wrapper({ children }: { children: ReactNode }) {
    return <RingFeedProvider roomId="room-a">{children}</RingFeedProvider>;
  }

  it('re-subscribes even when the cursor has not moved', () => {
    // The stuck case: resuming only set `lastEventId`, which in a quiet room is the value
    // it already had. React bails out on an unchanged value, so the subscription input
    // never changed, tRPC never re-subscribed, and no handshake ever arrived to clear the
    // banner.
    vi.useFakeTimers();
    try {
      renderHook(() => useRingFeedContextForTest(), { wrapper });

      act(() => {
        latestCall().onData?.({ id: 'h1', data: makeEvent({ id: 'h1', type: 'handshake' }) });
      });

      const before = subscriptionCalls.length;
      const inputBefore = { ...latestCall().input };

      act(() => {
        vi.advanceTimersByTime(HEARTBEAT_TIMEOUT_MS + 1_000);
      });

      expect(subscriptionCalls.length).toBeGreaterThan(before);
      expect(latestCall().input).not.toEqual(inputBefore);
    } finally {
      vi.useRealTimers();
    }
  });

  it('clears the banner once the resumed subscription hands shakes', () => {
    vi.useFakeTimers();
    try {
      const { result } = renderHook(() => useRingFeedContextForTest(), { wrapper });

      act(() => {
        latestCall().onData?.({ id: 'h1', data: makeEvent({ id: 'h1', type: 'handshake' }) });
      });
      act(() => {
        vi.advanceTimersByTime(HEARTBEAT_TIMEOUT_MS + 1_000);
      });
      expect(result.current.reconnecting).toBe(true);

      act(() => {
        latestCall().onData?.({ id: 'h2', data: makeEvent({ id: 'h2', type: 'handshake' }) });
      });

      expect(result.current.reconnecting).toBe(false);
      expect(result.current.connected).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});

/**
 * A locked phone has its timers frozen, and a `setTimeout` that came due while suspended
 * fires the instant the page is shown again, ahead of the frames queued meanwhile, so the
 * watchdog reported a dead connection purely because time passed in the background (#127).
 * The first fix gave a fresh full timeout, which made a dead socket wait again (baseline C2):
 * now the page being shown is the moment the connection is tested.
 */
describe('useRingFeed: returning from the background', () => {
  function wrapper({ children }: { children: ReactNode }) {
    return <RingFeedProvider roomId="room-a">{children}</RingFeedProvider>;
  }

  function setVisibility(state: 'visible' | 'hidden') {
    Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  }

  const hs = (id: string) => ({ id, data: makeEvent({ id, type: 'handshake', scope: 'private' }) });

  it('does not trip on a watchdog that came due while the page was hidden', () => {
    vi.useFakeTimers();
    try {
      const { result } = renderHook(() => useRingFeedContextForTest(), { wrapper });
      act(() => latestCall().onData?.(hs('h1')));

      act(() => {
        setVisibility('hidden');
        vi.advanceTimersByTime(HEARTBEAT_TIMEOUT_MS + 5_000);
      });

      // Silence while hidden is not evidence: nothing happened.
      expect(result.current.reconnecting).toBe(false);
      expect(result.current.connected).toBe(true);
    } finally {
      setVisibility('visible');
      vi.useRealTimers();
    }
  });

  it('a frame that was queued while frozen, delivered inside the grace, proves the connection alive', () => {
    vi.useFakeTimers();
    try {
      const { result } = renderHook(() => useRingFeedContextForTest(), { wrapper });
      act(() => latestCall().onData?.(hs('h1')));

      act(() => {
        setVisibility('hidden');
        vi.advanceTimersByTime(5 * 60_000);
        setVisibility('visible');
      });
      act(() => {
        vi.advanceTimersByTime(RESUME_GRACE_MS - 500);
        latestCall().onData?.({ id: 'hb', data: makeEvent({ id: 'hb', type: 'heartbeat' }) });
      });
      act(() => {
        vi.advanceTimersByTime(RESUME_GRACE_MS * 3);
      });

      expect(result.current.reconnecting).toBe(false);
      expect(result.current.connected).toBe(true);
    } finally {
      setVisibility('visible');
      vi.useRealTimers();
    }
  });

  it('a dead connection is resubscribed shortly after the page is shown, not a full timeout later (baseline C2)', () => {
    vi.useFakeTimers();
    try {
      const { result } = renderHook(() => useRingFeedContextForTest(), { wrapper });
      act(() => latestCall().onData?.(hs('h1')));
      const before = subscriptionCalls.length;

      act(() => {
        setVisibility('hidden');
        vi.advanceTimersByTime(HEARTBEAT_INTERVAL_MS + 4_000);
        setVisibility('visible');
      });
      // Still inside the grace: no verdict yet.
      act(() => {
        vi.advanceTimersByTime(RESUME_GRACE_MS - 100);
      });
      expect(result.current.reconnecting).toBe(false);
      act(() => {
        vi.advanceTimersByTime(200);
      });

      expect(result.current.reconnecting).toBe(true);
      expect(subscriptionCalls.length).toBeGreaterThan(before);
      expect(latestCall().input.resumeAttempt).toBe(1);
    } finally {
      setVisibility('visible');
      vi.useRealTimers();
    }
  });

  it('a recent last frame only re-arms the watchdog for what remains of the timeout', () => {
    vi.useFakeTimers();
    try {
      const { result } = renderHook(() => useRingFeedContextForTest(), { wrapper });
      act(() => latestCall().onData?.(hs('h1')));

      act(() => {
        setVisibility('hidden');
        vi.advanceTimersByTime(3_000);
        setVisibility('visible');
        vi.advanceTimersByTime(RESUME_GRACE_MS + 100);
      });
      expect(result.current.reconnecting).toBe(false);

      // 5.1 s have passed since the last frame; the watchdog still trips at 20 s, not 25.1 s.
      act(() => {
        vi.advanceTimersByTime(HEARTBEAT_TIMEOUT_MS - 3_000 - RESUME_GRACE_MS - 100 + 200);
      });
      expect(result.current.reconnecting).toBe(true);
    } finally {
      setVisibility('visible');
      vi.useRealTimers();
    }
  });

  it('pageshow runs the same check', () => {
    vi.useFakeTimers();
    try {
      const { result } = renderHook(() => useRingFeedContextForTest(), { wrapper });
      act(() => latestCall().onData?.(hs('h1')));
      act(() => {
        vi.advanceTimersByTime(HEARTBEAT_INTERVAL_MS + 4_000);
        window.dispatchEvent(new Event('pageshow'));
        vi.advanceTimersByTime(RESUME_GRACE_MS + 100);
      });
      expect(result.current.reconnecting).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('useRingFeed: offline and online (baseline C3)', () => {
  function wrapper({ children }: { children: ReactNode }) {
    return <RingFeedProvider roomId="room-a">{children}</RingFeedProvider>;
  }
  const hs = (id: string) => ({ id, data: makeEvent({ id, type: 'handshake', scope: 'private' }) });

  it('offline shows reconnecting at once and leaves the subscription alone', () => {
    vi.useFakeTimers();
    try {
      const { result } = renderHook(() => useRingFeedContextForTest(), { wrapper });
      act(() => latestCall().onData?.(hs('h1')));
      const inputBefore = { ...latestCall().input };

      act(() => {
        window.dispatchEvent(new Event('offline'));
      });

      expect(result.current.reconnecting).toBe(true);
      expect(result.current.connected).toBe(false);
      expect(latestCall().input).toEqual(inputBefore);
    } finally {
      vi.useRealTimers();
    }
  });

  it('online with no frame inside the grace resubscribes, however short the outage was', () => {
    vi.useFakeTimers();
    try {
      const { result } = renderHook(() => useRingFeedContextForTest(), { wrapper });
      act(() => latestCall().onData?.(hs('h1')));
      act(() => {
        vi.advanceTimersByTime(1_000);
        window.dispatchEvent(new Event('offline'));
        vi.advanceTimersByTime(1_000);
        window.dispatchEvent(new Event('online'));
      });
      expect(latestCall().input.resumeAttempt).toBe(0);

      act(() => {
        vi.advanceTimersByTime(RESUME_GRACE_MS + 100);
      });
      expect(latestCall().input.resumeAttempt).toBe(1);
      expect(result.current.reconnecting).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('online with a frame inside the grace clears the banner and resubscribes nothing', () => {
    vi.useFakeTimers();
    try {
      const { result } = renderHook(() => useRingFeedContextForTest(), { wrapper });
      act(() => latestCall().onData?.(hs('h1')));
      act(() => {
        window.dispatchEvent(new Event('offline'));
        window.dispatchEvent(new Event('online'));
        vi.advanceTimersByTime(500);
        latestCall().onData?.({ id: 'hb', data: makeEvent({ id: 'hb', type: 'heartbeat' }) });
        vi.advanceTimersByTime(RESUME_GRACE_MS * 2);
      });
      expect(result.current.reconnecting).toBe(false);
      expect(latestCall().input.resumeAttempt).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('useRingFeed: resubscribe backoff (baseline C6)', () => {
  function wrapper({ children }: { children: ReactNode }) {
    return <RingFeedProvider roomId="room-a">{children}</RingFeedProvider>;
  }
  const hs = (id: string) => ({ id, data: makeEvent({ id, type: 'handshake', scope: 'private' }) });
  const attempt = () => latestCall().input.resumeAttempt ?? 0;

  it('retries at once, then waits longer each time a resubscribe fails, and resets on a handshake', () => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0.5); // no jitter
    try {
      const { result } = renderHook(() => useRingFeedContextForTest(), { wrapper });
      act(() => latestCall().onData?.(hs('h1')));

      act(() => latestCall().onError?.());
      expect(attempt()).toBe(1); // first retry: immediate
      expect(result.current.reconnecting).toBe(true);

      for (const wait of [500, 1_000, 2_000, 4_000, 8_000, 8_000]) {
        const n = attempt();
        act(() => latestCall().onError?.());
        expect(attempt()).toBe(n); // not yet
        act(() => {
          vi.advanceTimersByTime(wait - 1);
        });
        expect(attempt()).toBe(n);
        act(() => {
          vi.advanceTimersByTime(1);
        });
        expect(attempt()).toBe(n + 1);
        expect(result.current.reconnecting).toBe(true); // stays true while waiting
      }

      // A handshake resets the schedule.
      act(() => latestCall().onData?.(hs('h2')));
      expect(result.current.reconnecting).toBe(false);
      const n = attempt();
      act(() => latestCall().onError?.());
      expect(attempt()).toBe(n + 1);
    } finally {
      vi.restoreAllMocks();
      vi.useRealTimers();
    }
  });

  it('a second loss signal while a retry is waiting adds nothing', () => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    try {
      renderHook(() => useRingFeedContextForTest(), { wrapper });
      act(() => latestCall().onData?.(hs('h1')));
      act(() => latestCall().onError?.());
      const n = attempt();
      act(() => latestCall().onError?.());
      act(() => latestCall().onError?.());
      act(() => {
        vi.advanceTimersByTime(500);
      });
      expect(attempt()).toBe(n + 1);
      act(() => {
        vi.advanceTimersByTime(60_000);
      });
      // Only the resubscribe's own watchdog can add more, not the duplicate signals.
      expect(attempt()).toBeLessThanOrEqual(n + 3);
    } finally {
      vi.restoreAllMocks();
      vi.useRealTimers();
    }
  });

  it('resubscribes with the newest cursor, read when the retry runs', () => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    try {
      renderHook(() => useRingFeedContextForTest(), { wrapper });
      act(() => latestCall().onData?.(hs('h1')));
      act(() => latestCall().onError?.());
      act(() => latestCall().onError?.()); // second failure: waits 500 ms
      act(() => {
        latestCall().onData?.({ id: '777-late', data: makeEvent({ id: '777-late', type: 'announce' }) });
      });
      // The late frame proves life and cancels the retry.
      act(() => {
        vi.advanceTimersByTime(5_000);
      });
      expect(latestCall().input.resumeAttempt).toBe(1);
    } finally {
      vi.restoreAllMocks();
      vi.useRealTimers();
    }
  });

  it('a room change cancels a pending retry', () => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    try {
      const { rerender } = renderHook(
        ({ roomId }: { roomId: string }) => useRingFeed(roomId),
        { initialProps: { roomId: 'room-a' } }
      );
      act(() => latestCall().onError?.());
      act(() => latestCall().onError?.()); // waits 500 ms
      act(() => {
        rerender({ roomId: 'room-b' });
      });
      act(() => {
        vi.advanceTimersByTime(1_000);
      });
      expect(latestCall().input).toEqual({ roomId: 'room-b', lastEventId: undefined, resumeAttempt: 0 });
    } finally {
      vi.restoreAllMocks();
      vi.useRealTimers();
    }
  });

  it('unmounting cancels a pending retry', () => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    try {
      const { unmount } = renderHook(() => useRingFeed('room-a'));
      act(() => latestCall().onError?.());
      act(() => latestCall().onError?.());
      const calls = subscriptionCalls.length;
      unmount();
      act(() => {
        vi.advanceTimersByTime(10_000);
      });
      expect(subscriptionCalls.length).toBe(calls);
    } finally {
      vi.restoreAllMocks();
      vi.useRealTimers();
    }
  });
});

/**
 * A stranded "connection lost" divider with events still scrolling past it, reported from
 * a live phone session. The watchdog had tripped on a subscription that was never dead, and
 * `reconnecting` cleared only on a handshake — so the still-healthy subscription went on
 * delivering events while the app insisted it was reconnecting. See 10b-bugs-fixed.md #128.
 */
describe('useRingFeed: a frame is proof the connection is alive', () => {
  function wrapper({ children }: { children: ReactNode }) {
    return <RingFeedProvider roomId="room-a">{children}</RingFeedProvider>;
  }

  it('clears a spurious reconnecting state on any frame, not just a handshake', () => {
    vi.useFakeTimers();
    try {
      const { result } = renderHook(() => useRingFeedContextForTest(), { wrapper });

      act(() => {
        latestCall().onData?.({ id: 'h1', data: makeEvent({ id: 'h1', type: 'handshake' }) });
      });
      act(() => {
        vi.advanceTimersByTime(HEARTBEAT_TIMEOUT_MS + 1_000);
      });
      expect(result.current.reconnecting).toBe(true);

      // The original subscription was never dead and keeps delivering.
      act(() => {
        latestCall().onData?.({ id: 'e1', data: makeEvent({ id: 'e1', type: 'ring.add' }) });
      });

      expect(result.current.reconnecting).toBe(false);
      expect(result.current.connected).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('counts a heartbeat as proof too — it is a frame like any other', () => {
    vi.useFakeTimers();
    try {
      const { result } = renderHook(() => useRingFeedContextForTest(), { wrapper });

      act(() => {
        latestCall().onData?.({ id: 'h1', data: makeEvent({ id: 'h1', type: 'handshake' }) });
      });
      act(() => {
        vi.advanceTimersByTime(HEARTBEAT_TIMEOUT_MS + 1_000);
      });
      act(() => {
        latestCall().onData?.({ id: 'hb', data: makeEvent({ id: 'hb', type: 'heartbeat' }) });
      });

      expect(result.current.reconnecting).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  describe('chat frames', () => {
    const chatMessage = (id: number, roomId = 'room-a') => ({
      id,
      roomId,
      senderUserId: 'u2',
      senderName: 'Ben',
      recipientUserId: null,
      recipientName: null,
      text: `hello ${id}`,
      fightNumber: null,
      source: 'web',
      createdAt: new Date().toISOString(),
    });
    const sendChat = (message: ReturnType<typeof chatMessage>) => {
      // The server yields chat as an untracked frame: no `data`, just type/id/payload.
      latestCall().onData?.({ type: 'chat', id: `chat-${message.id}`, payload: message } as never);
    };

    it('goes to chat listeners only: never to pane listeners, and never moves the game cursor', () => {
      const { result } = renderHook(() => useRingFeed('room-a'));
      const paneHandler = vi.fn();
      const chatHandler = vi.fn();
      act(() => {
        result.current.subscribe(paneHandler);
        result.current.subscribeChat(chatHandler);
      });

      act(() => {
        latestCall().onData?.({ id: '5000-evt', data: makeEvent({ id: '5000-evt', type: 'ring.add' }) });
      });
      expect(latestCall().input.lastEventId).toBeUndefined();

      const message = chatMessage(7);
      act(() => sendChat(message));
      // A chat id is not an event id; even a "newer" looking one must not become the cursor.
      act(() => sendChat(chatMessage(99999999999999)));

      expect(paneHandler).toHaveBeenCalledTimes(1);
      expect(chatHandler).toHaveBeenNthCalledWith(1, { kind: 'message', message });
      expect(chatHandler).toHaveBeenCalledTimes(2);

      // Force a resume: the cursor it resumes from is still the last real event.
      act(() => latestCall().onError?.());
      expect(latestCall().input.lastEventId).toBe('5000-evt');
    });

    it('does not cursor-seed from chat when there are no game events yet', () => {
      const { result } = renderHook(() => useRingFeed('room-a'));
      act(() => result.current.subscribeChat(vi.fn()));
      act(() => sendChat(chatMessage(1)));
      act(() => latestCall().onError?.());
      expect(latestCall().input.lastEventId).toBeUndefined();
    });

    it('drops a chat frame for another room and signals each handshake as connected', () => {
      const { result } = renderHook(() => useRingFeed('room-a'));
      const chatHandler = vi.fn();
      act(() => {
        result.current.subscribeChat(chatHandler);
      });
      act(() => sendChat(chatMessage(1, 'room-b')));
      expect(chatHandler).not.toHaveBeenCalled();

      act(() => {
        latestCall().onData?.({ id: '1-handshake', data: makeEvent({ id: '1-handshake', type: 'handshake' }) });
      });
      expect(chatHandler).toHaveBeenCalledWith({ kind: 'connected' });
    });

    it('counts a chat frame as proof of life, like any frame', () => {
      const { result } = renderHook(() => useRingFeedContextForTest(), { wrapper });
      act(() => sendChat(chatMessage(1)));
      expect(result.current.connected).toBe(true);
    });
  });
});

/**
 * tRPC's wsClient reconnects a dead socket by itself and does not error the subscription: the
 * hook's `status` goes back to 'connecting'. That must show as reconnecting (and so bracket the
 * replay with dividers) without resubscribing.
 */
describe('useRingFeed: the transport reconnecting on its own', () => {
  function wrapper({ children }: { children: ReactNode }) {
    return <RingFeedProvider roomId="room-a">{children}</RingFeedProvider>;
  }
  const hs = (id: string) => ({ id, data: makeEvent({ id, type: 'handshake', scope: 'private' }) });

  it('does not trip on the initial connect', () => {
    subscriptionStatus = 'connecting';
    const { result } = renderHook(() => useRingFeedContextForTest(), { wrapper });
    expect(result.current.reconnecting).toBe(false);
  });

  it('does not trip when a frame lands before the first commit reports its still-initial status', () => {
    // The lab (and any transport that delivers synchronously) has a frame in before the effect
    // reads the render-time 'connecting'.
    subscriptionStatus = 'connecting';
    earlyDeliverOnSubscribe = { id: '1-handshake', data: makeEvent({ id: '1-handshake', type: 'handshake', scope: 'private' }) };
    const { result } = renderHook(() => useRingFeedContextForTest(), { wrapper });
    expect(result.current.reconnecting).toBe(false);
  });

  it('shows reconnecting when status returns to connecting after a frame, leaves the subscription alone, and clears on the next frame', () => {
    subscriptionStatus = 'connecting';
    const { result, rerender } = renderHook(() => useRingFeedContextForTest(), { wrapper });
    act(() => latestCall().onData?.(hs('h1')));
    subscriptionStatus = 'pending';
    rerender();
    expect(result.current.reconnecting).toBe(false);
    const inputBefore = { ...latestCall().input };

    subscriptionStatus = 'connecting';
    rerender();
    expect(result.current.reconnecting).toBe(true);
    expect(result.current.connected).toBe(false);
    expect(latestCall().input).toEqual(inputBefore);

    act(() => latestCall().onData?.(hs('h2')));
    expect(result.current.reconnecting).toBe(false);
    expect(result.current.connected).toBe(true);
  });

  it('does not count again while the app\'s own loss path is already running', () => {
    feedTimings.reset();
    subscriptionStatus = 'pending';
    const { rerender } = renderHook(() => useRingFeedContextForTest(), { wrapper });
    act(() => latestCall().onData?.(hs('h1')));
    act(() => latestCall().onError?.()); // our own path: resubscribes, status resets to connecting
    subscriptionStatus = 'connecting';
    rerender();
    expect(feedTimings.snapshot().counters['conn.transport_reconnecting'] ?? 0).toBe(0);
  });
});

import { act, render, renderHook, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import type { GameEvent } from '@deck-monsters/server/types';
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

  it('advances shared cursor monotonically across history seeds and live events', () => {
    const { result, rerender } = renderHook(() => useRingFeed('room-a'));

    // older → newer history tails
    act(() => {
      result.current.seedCursor('100-ring-hist');
    });
    rerender();
    expect(latestCall().input.lastEventId).toBe('100-ring-hist');

    act(() => {
      result.current.seedCursor('200-console-hist');
    });
    rerender();
    expect(latestCall().input.lastEventId).toBe('200-console-hist');

    // newer → older must not move backwards
    act(() => {
      result.current.seedCursor('150-older-hist');
    });
    rerender();
    expect(latestCall().input.lastEventId).toBe('200-console-hist');

    // live newer than history advances the tracked cursor (subscription input
    // still only changes on error / seed); older history cannot overwrite it
    act(() => {
      latestCall().onData?.({
        id: '300-live',
        data: makeEvent({ id: '300-live', type: 'announce' }),
      });
      result.current.seedCursor('250-stale-hist');
      latestCall().onError?.();
    });
    rerender();
    expect(latestCall().input.lastEventId).toBe('300-live');

    // live older than current cursor does not rewind
    act(() => {
      latestCall().onData?.({
        id: '280-old-live',
        data: makeEvent({ id: '280-old-live', type: 'announce' }),
      });
      latestCall().onError?.();
    });
    rerender();
    expect(latestCall().input.lastEventId).toBe('300-live');
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
 * here. See 10-bug-fixes.md D and 10b-bugs-fixed.md #127.
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
 * fires the instant the page is shown again — so the watchdog reported a dead connection
 * purely because time passed in the background. No frames can arrive while the page is
 * suspended whether the socket is healthy or not, so that is not evidence of anything.
 */
describe('useRingFeed: returning from the background', () => {
  function wrapper({ children }: { children: ReactNode }) {
    return <RingFeedProvider roomId="room-a">{children}</RingFeedProvider>;
  }

  function setVisibility(state: 'visible' | 'hidden') {
    Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  }

  it('gives the connection a fresh interval instead of tripping on a stale timer', () => {
    vi.useFakeTimers();
    try {
      const { result } = renderHook(() => useRingFeedContextForTest(), { wrapper });

      act(() => {
        latestCall().onData?.({ id: 'h1', data: makeEvent({ id: 'h1', type: 'handshake' }) });
      });

      // Most of the interval passes with the page hidden, then it comes back.
      act(() => {
        setVisibility('hidden');
        vi.advanceTimersByTime(HEARTBEAT_TIMEOUT_MS - 1_000);
        setVisibility('visible');
      });

      // The old timer would have fired 1s later; the fresh one has the full interval.
      act(() => {
        vi.advanceTimersByTime(5_000);
      });

      expect(result.current.reconnecting).toBe(false);
      expect(result.current.connected).toBe(true);
    } finally {
      setVisibility('visible');
      vi.useRealTimers();
    }
  });

  it('still reports a genuinely dead connection one interval later', () => {
    // The grace is one interval, not immunity.
    vi.useFakeTimers();
    try {
      const { result } = renderHook(() => useRingFeedContextForTest(), { wrapper });

      act(() => {
        latestCall().onData?.({ id: 'h1', data: makeEvent({ id: 'h1', type: 'handshake' }) });
      });

      act(() => {
        setVisibility('hidden');
        vi.advanceTimersByTime(HEARTBEAT_TIMEOUT_MS - 1_000);
        setVisibility('visible');
      });
      act(() => {
        vi.advanceTimersByTime(HEARTBEAT_TIMEOUT_MS + 1_000);
      });

      expect(result.current.reconnecting).toBe(true);
    } finally {
      setVisibility('visible');
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
});

import { act, render, renderHook, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import type { GameEvent } from '@deck-monsters/server/types';
import {
  RingFeedProvider,
  useRingFeed,
  useRingFeedListener,
  type TrackedRingFeedEvent,
} from '../hooks/useRingFeed.js';

type TrackedEvent = { id: string; data: GameEvent };

const subscriptionCalls: Array<{
  input: { roomId: string; lastEventId?: string };
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
          input: { roomId: string; lastEventId?: string },
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
    expect(latestCall().input).toEqual({ roomId: 'room-a', lastEventId: undefined });

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
    expect(subscriptionCalls).toHaveLength(1);
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

    expect(latestCall().input).toEqual({ roomId: 'room-b', lastEventId: undefined });

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

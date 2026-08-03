import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameEvent } from '@deck-monsters/server/types';

type TrackedEvent = { id: string; data: GameEvent };

const subscriptionCalls: Array<{
  input: { roomId: string; lastEventId?: string };
  onData?: (tracked: TrackedEvent) => void;
  onError?: () => void;
}> = [];

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
        },
      },
    },
  },
}));

import { useRingFeed } from '../hooks/useRingFeed.js';

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

describe('useRingFeed', () => {
  beforeEach(() => {
    subscriptionCalls.length = 0;
    handleHandshakeEvent.mockReset();
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

  it('seeds the shared cursor from history only when empty', () => {
    const { result, rerender } = renderHook(() => useRingFeed('room-a'));

    act(() => {
      result.current.seedCursor('hist-1');
    });
    rerender();
    expect(latestCall().input.lastEventId).toBe('hist-1');

    act(() => {
      result.current.seedCursor('hist-2');
    });
    rerender();
    expect(latestCall().input.lastEventId).toBe('hist-1');

    act(() => {
      latestCall().onData?.({
        id: 'live-9',
        data: makeEvent({ id: 'live-9', type: 'announce' }),
      });
      result.current.seedCursor('hist-3');
      latestCall().onError?.();
    });
    rerender();
    expect(latestCall().input.lastEventId).toBe('live-9');
  });
});

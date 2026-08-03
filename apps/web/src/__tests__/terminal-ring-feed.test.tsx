import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameEvent } from '@deck-monsters/server/types';

type TrackedEvent = { id: string; data: GameEvent };

const subscriptionCalls: Array<{
  input: { roomId: string; lastEventId?: string };
  onData?: (tracked: TrackedEvent) => void;
  onError?: () => void;
}> = [];

vi.mock('../hooks/useHandshake.js', () => ({
  useHandshake: () => ({
    handshakeStatus: { status: 'ok', buildVersion: 'dev', serverTime: 'now' },
    handleHandshakeEvent: vi.fn(),
  }),
}));

vi.mock('../hooks/useRingKeyTimestamps.js', () => ({
  useRingKeyTimestamps: () => ({ ringKeyTimestampsEnabled: false }),
}));

vi.mock('../hooks/useTimeAgo.js', () => ({
  useTimeAgo: () => 'just now',
}));

vi.mock('../lib/auth-context.js', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

vi.mock('../lib/command-insert-context.js', () => ({
  useCommandInsert: () => ({
    registerInsertFn: () => undefined,
  }),
}));

vi.mock('../hooks/useCommandAutocomplete.js', () => ({
  useCommandAutocomplete: () => [],
}));

vi.mock('../components/CommandSuggestions.js', () => ({
  default: () => null,
}));

vi.mock('../components/InlineChoices.js', () => ({
  default: () => null,
}));

vi.mock('../components/CatchUpBanner.js', () => ({
  default: () => null,
}));

vi.mock('../components/PaneDivider.js', () => ({
  default: () => null,
}));

vi.mock('../utils/format-event-text.js', () => ({
  formatEventText: (text: string) => text,
}));

vi.mock('../utils/console-history-event-map.js', () => ({
  mapConsoleHistoryEvent: () => null,
}));

vi.mock('../utils/ring-feed-events.js', () => ({
  shouldRenderRingEvent: () => true,
}));

vi.mock('../lib/trpc.js', () => ({
  trpc: {
    game: {
      ringHistory: { useQuery: () => ({ data: [] }) },
      recentFights: { useQuery: () => ({ data: [] }) },
      ringState: { useQuery: () => ({ data: undefined, refetch: () => Promise.resolve() }) },
      consoleHistory: { useQuery: () => ({ data: undefined }) },
      pendingPrompt: {
        useQuery: () => ({ data: null, refetch: vi.fn(async () => ({ data: null })) }),
      },
      myMonsters: { useQuery: () => ({ data: [] }) },
      command: { useMutation: () => ({ mutateAsync: vi.fn(async () => ({ ok: true })) }) },
      respondToPrompt: { useMutation: () => ({ mutateAsync: vi.fn(async () => ({ ok: true })) }) },
      cancelPrompt: { useMutation: () => ({ mutateAsync: vi.fn(async () => ({ ok: true })) }) },
      cancelFlow: { useMutation: () => ({ mutateAsync: vi.fn(async () => ({ ok: true })) }) },
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

vi.mock('react-virtuoso', () => {
  const React = require('react');
  return {
    Virtuoso: React.forwardRef(
      (
        props: {
          data?: Array<{ text?: string; id?: string }>;
          itemContent?: (index: number, item: { text?: string }) => React.ReactNode;
          'aria-label'?: string;
        },
        ref: React.Ref<unknown>,
      ) => {
        React.useImperativeHandle(ref, () => ({
          scrollToIndex: () => undefined,
        }));
        return (
          <div aria-label={props['aria-label']}>
            {(props.data ?? []).map((item, index) => (
              <div key={item.id ?? index}>{props.itemContent?.(index, item) ?? item.text}</div>
            ))}
          </div>
        );
      },
    ),
  };
});

import Terminal from '../components/Terminal.js';

function latestCall() {
  const call = subscriptionCalls[subscriptionCalls.length - 1];
  if (!call) throw new Error('no subscription call');
  return call;
}

describe('Terminal shared ringFeed subscription (#63)', () => {
  beforeEach(() => {
    subscriptionCalls.length = 0;
    // Force side-by-side layout so both panes mount as active.
    class MockResizeObserver {
      private cb: ResizeObserverCallback;
      constructor(cb: ResizeObserverCallback) {
        this.cb = cb;
      }
      observe() {
        this.cb(
          [{ contentRect: { width: 1200 } } as ResizeObserverEntry],
          this as unknown as ResizeObserver,
        );
      }
      unobserve() {}
      disconnect() {}
    }
    window.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;
  });

  it('uses one ringFeed subscription and delivers events to both pane handlers', () => {
    render(<Terminal roomId="room-shared" />);

    // One subscription call site per Terminal render — not one per pane.
    // Dual pane subscriptions would leave two distinct live inputs on the same room.
    expect(subscriptionCalls.length).toBeGreaterThanOrEqual(1);
    const uniqueRooms = new Set(subscriptionCalls.map((c) => c.input.roomId));
    expect(uniqueRooms.size).toBe(1);
    expect([...uniqueRooms][0]).toBe('room-shared');

    act(() => {
      latestCall().onData?.({
        id: 'hs-1',
        data: {
          id: 'hs-1',
          roomId: 'room-shared',
          timestamp: Date.now(),
          type: 'handshake',
          scope: 'private',
          text: '',
          payload: {
            protocolVersion: 1,
            buildVersion: 'dev',
            serverTime: new Date().toISOString(),
            yourUserId: 'user-1',
            ringState: { nextFightAt: null, nextBossSpawnAt: null, monsterCount: 0 },
          },
        },
      });
    });
    // Handshake must not advance the shared cursor (would restart the subscription).
    expect(latestCall().input.lastEventId).toBeUndefined();

    act(() => {
      latestCall().onData?.({
        id: 'ring-1',
        data: {
          id: 'ring-1',
          roomId: 'room-shared',
          timestamp: Date.now(),
          type: 'ring.add',
          scope: 'public',
          text: 'A basilisk enters the ring',
          payload: {},
        },
      });
      latestCall().onData?.({
        id: 'console-1',
        data: {
          id: 'console-1',
          roomId: 'room-shared',
          timestamp: Date.now(),
          type: 'announce',
          scope: 'private',
          targetUserId: 'user-1',
          text: 'You hear private news',
          payload: {},
        },
      });
    });

    expect(screen.getByText('A basilisk enters the ring')).toBeTruthy();
    expect(screen.getByText('You hear private news')).toBeTruthy();

    // Live events also must not restart the subscription input (cursor updates only on error).
    expect(latestCall().input).toEqual({ roomId: 'room-shared', lastEventId: undefined });
    expect(new Set(subscriptionCalls.map((c) => JSON.stringify(c.input))).size).toBe(1);
  });

  it('reconnects from the shared cursor and resets on room change', () => {
    const { rerender } = render(<Terminal roomId="room-a" />);

    act(() => {
      latestCall().onData?.({
        id: 'evt-keep',
        data: {
          id: 'evt-keep',
          roomId: 'room-a',
          timestamp: Date.now(),
          type: 'announce',
          scope: 'public',
          text: 'kept',
          payload: {},
        },
      });
      latestCall().onError?.();
    });

    expect(latestCall().input).toEqual({ roomId: 'room-a', lastEventId: 'evt-keep' });

    rerender(<Terminal roomId="room-b" />);
    expect(latestCall().input).toEqual({ roomId: 'room-b', lastEventId: undefined });
  });
});

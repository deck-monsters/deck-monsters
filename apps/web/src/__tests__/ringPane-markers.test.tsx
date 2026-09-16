import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';

import {
  RingFeedContext,
  type RingFeedApi,
  type TrackedRingFeedEvent,
} from '../hooks/useRingFeed.js';
import RingPane from '../components/RingPane.js';

const listeners = new Set<(tracked: TrackedRingFeedEvent) => void>();

function push(tracked: TrackedRingFeedEvent) {
  for (const listener of listeners) listener(tracked);
}

vi.mock('../hooks/useRingKeyTimestamps.js', () => ({
  useRingKeyTimestamps: () => ({ ringKeyTimestampsEnabled: false }),
}));
vi.mock('../hooks/useTimeAgo.js', () => ({ useTimeAgo: () => 'just now' }));
vi.mock('../utils/ring-feed-events.js', () => ({ shouldRenderRingEvent: () => true }));
vi.mock('../lib/trpc.js', () => ({
  trpc: {
    game: {
      ringHistory: { useQuery: () => ({ data: [] }) },
      recentFights: { useQuery: () => ({ data: [] }) },
      ringState: { useQuery: () => ({ data: undefined, refetch: () => Promise.resolve() }) },
    },
  },
}));

vi.mock('react-virtuoso', () => {
  const React = require('react');
  return {
    Virtuoso: React.forwardRef(
      (
        props: { data?: Array<unknown>; itemContent?: (i: number, item: unknown) => React.ReactNode },
        ref: React.Ref<unknown>
      ) => {
        React.useImperativeHandle(ref, () => ({ scrollToIndex: () => undefined }));
        return (
          <div>
            {(props.data ?? []).map((item, index) => (
              <div key={index}>{props.itemContent?.(index, item) ?? null}</div>
            ))}
          </div>
        );
      }
    ),
  };
});

function TestFeed({ children }: { children: ReactNode }) {
  const value: RingFeedApi = {
    connected: true,
    reconnecting: false,
    seedCursor: () => undefined,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  return <RingFeedContext.Provider value={value}>{children}</RingFeedContext.Provider>;
}

function ev(id: string, type: string, timestamp: number) {
  return {
    id,
    data: {
      id,
      roomId: 'room-1',
      timestamp,
      type,
      scope: 'public',
      text: `event ${id}`,
      payload: {},
    },
  } as TrackedRingFeedEvent;
}

describe('RingPane reconnect divider (#107)', () => {
  beforeEach(() => {
    listeners.clear();
  });

  /**
   * The bracket must always close. Waiting only on an event that postdates the reconnect
   * leaves "connection lost" dangling forever over a recovered feed when the ring is
   * quiet, or when clock skew makes server timestamps trail the client's Date.now().
   */
  it('draws "reconnected" on a grace timer when no further event arrives', () => {
    vi.useFakeTimers();
    try {
      render(
        <TestFeed>
          <RingPane roomId="room-1" isActive />
        </TestFeed>
      );

      act(() => {
        push(ev('h1', 'handshake', Date.now()));
        push(ev('e1', 'announce', Date.now()));
      });
      expect(screen.queryByText('reconnected')).toBeNull();

      // A second handshake is a reconnect.
      act(() => {
        push(ev('h2', 'handshake', Date.now()));
      });
      expect(screen.queryByText('reconnected')).toBeNull();

      // Nothing else ever arrives — the timer must still close the bracket.
      act(() => {
        vi.advanceTimersByTime(5_000);
      });
      expect(screen.getByText('reconnected')).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });

  it('closes the bracket early when a newer event arrives first', () => {
    vi.useFakeTimers();
    try {
      render(
        <TestFeed>
          <RingPane roomId="room-1" isActive />
        </TestFeed>
      );

      act(() => {
        push(ev('h1', 'handshake', Date.now()));
        push(ev('e1', 'announce', Date.now()));
        push(ev('h2', 'handshake', Date.now()));
      });

      act(() => {
        push(ev('e2', 'announce', Date.now() + 1_000));
      });

      // Drawn without waiting out the grace period.
      expect(screen.getByText('reconnected')).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });

  it('draws no divider on the first connection', () => {
    render(
      <TestFeed>
        <RingPane roomId="room-1" isActive />
      </TestFeed>
    );

    act(() => {
      push(ev('h1', 'handshake', Date.now()));
      push(ev('e1', 'announce', Date.now()));
    });

    expect(screen.queryByText('reconnected')).toBeNull();
  });
});

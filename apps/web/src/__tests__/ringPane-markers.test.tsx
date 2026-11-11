import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';

import {
  RingFeedContext,
  type RingFeedApi,
  type TrackedRingFeedEvent,
} from '../hooks/useRingFeed.js';
import RingPane from '../components/RingPane.js';
import { LOSS_MARKER_DELAY_MS } from '../utils/feed-markers.js';

const listeners = new Set<(tracked: TrackedRingFeedEvent) => void>();
// Hoisted so the `vi.mock` factory below can read it; a stable array, like react-query's `data`.
const historyRows: unknown[] = [];

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
      ringHistory: { useQuery: () => ({ data: historyRows }) },
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

function TestFeed({ children, reconnecting = false }: { children: ReactNode; reconnecting?: boolean }) {
  const value: RingFeedApi = {
    connected: !reconnecting,
    reconnecting,
    seedCursor: () => undefined,
    subscribeChat: () => () => undefined,
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

const pane = (reconnecting: boolean) => (
  <TestFeed reconnecting={reconnecting}>
    <RingPane roomId="room-1" isActive />
  </TestFeed>
);

/** Mount, connect, and put one live row in the feed. Returns the rerender function. */
function connected() {
  const view = render(pane(false));
  act(() => {
    push(ev('h1', 'handshake', Date.now()));
    push(ev('e1', 'announce', Date.now()));
  });
  return (reconnecting: boolean) => view.rerender(pane(reconnecting));
}

const markerTexts = () =>
  ['you joined here', 'connection lost', 'reconnected'].filter((t) => screen.queryByText(t) !== null);

describe('RingPane connection dividers (#107, baseline C4/C5)', () => {
  beforeEach(() => {
    listeners.clear();
    historyRows.length = 0;
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  /**
   * The bracket must always close. Waiting only on an event that postdates the reconnect
   * leaves "connection lost" dangling forever over a recovered feed when the ring is
   * quiet, or when clock skew makes server timestamps trail the client's Date.now().
   */
  it('draws "connection lost" after a second of loss, and "reconnected" on a grace timer', () => {
    const setReconnecting = connected();

    act(() => setReconnecting(true));
    expect(screen.queryByText('connection lost')).toBeNull();
    act(() => {
      vi.advanceTimersByTime(LOSS_MARKER_DELAY_MS + 100);
    });
    expect(screen.getByText('connection lost')).toBeTruthy();
    expect(screen.queryByText('reconnected')).toBeNull();

    act(() => {
      setReconnecting(false);
      push(ev('h2', 'handshake', Date.now()));
    });
    expect(screen.queryByText('reconnected')).toBeNull();

    // Nothing else ever arrives — the timer must still close the bracket.
    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    expect(screen.getByText('reconnected')).toBeTruthy();
  });

  it('closes the bracket early when a newer event arrives first', () => {
    const setReconnecting = connected();
    act(() => setReconnecting(true));
    act(() => {
      vi.advanceTimersByTime(LOSS_MARKER_DELAY_MS + 100);
    });
    act(() => {
      setReconnecting(false);
      push(ev('h2', 'handshake', Date.now()));
    });
    act(() => {
      push(ev('e2', 'announce', Date.now() + 1_000));
    });
    // Drawn without waiting out the grace period.
    expect(screen.getByText('reconnected')).toBeTruthy();
  });

  it('draws no divider on the first connection', () => {
    connected();
    expect(markerTexts()).toEqual([]);
  });

  it('draws no "reconnected" for a second handshake that follows no loss (baseline C4)', () => {
    connected();
    act(() => {
      push(ev('h2', 'handshake', Date.now()));
    });
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(markerTexts()).toEqual([]);
  });

  it('a blip that recovers within a second with nothing missed leaves no dividers at all', () => {
    const setReconnecting = connected();
    act(() => setReconnecting(true));
    act(() => {
      vi.advanceTimersByTime(300);
    });
    act(() => {
      setReconnecting(false);
      push(ev('h2', 'handshake', Date.now()));
    });
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(markerTexts()).toEqual([]);
  });

  it('a short outage that did miss events still brackets them, with the loss where the feed went quiet', () => {
    const setReconnecting = connected();
    const lostAt = Date.now();
    act(() => setReconnecting(true));
    act(() => {
      vi.advanceTimersByTime(300);
    });
    act(() => {
      setReconnecting(false);
      push(ev('h2', 'handshake', Date.now()));
      // Replayed catch-up: timestamped during the outage, delivered after the handshake.
      push(ev('e2', 'announce', lostAt + 100));
    });
    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    const order = [...document.body.querySelectorAll('li')].map((li) => li.textContent ?? '');
    const lost = order.findIndex((t) => t === 'connection lost');
    const back = order.findIndex((t) => t === 'reconnected');
    const missed = order.findIndex((t) => t.includes('event e2'));
    expect(lost).toBeGreaterThan(-1);
    expect(lost).toBeLessThan(missed);
    expect(missed).toBeLessThan(back);
  });

  it('a loss while the tail is already a divider still draws "connection lost" before "reconnected" (baseline C5)', () => {
    // History makes the tail "you joined here"; the quiet room has no live row yet.
    historyRows.push({
      id: '1-hist',
      roomId: 'room-1',
      timestamp: 1,
      type: 'announce',
      scope: 'public',
      text: 'event hist',
      payload: {},
    });
    const view = render(pane(false));
    act(() => {
      push(ev('h1', 'handshake', Date.now()));
    });
    expect(screen.getByText('you joined here')).toBeTruthy();

    act(() => view.rerender(pane(true)));
    act(() => {
      vi.advanceTimersByTime(LOSS_MARKER_DELAY_MS + 100);
    });
    expect(screen.getByText('connection lost')).toBeTruthy();
    act(() => {
      view.rerender(pane(false));
      push(ev('h2', 'handshake', Date.now()));
    });
    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    expect(markerTexts()).toEqual(['you joined here', 'connection lost', 'reconnected']);
  });

  it('two drops before "reconnected" is drawn make one outage, one pair of dividers', () => {
    const setReconnecting = connected();
    act(() => setReconnecting(true));
    act(() => {
      vi.advanceTimersByTime(LOSS_MARKER_DELAY_MS + 100);
    });
    act(() => {
      setReconnecting(false);
      push(ev('h2', 'handshake', Date.now()));
    });
    act(() => setReconnecting(true));
    act(() => {
      vi.advanceTimersByTime(LOSS_MARKER_DELAY_MS + 100);
    });
    act(() => {
      setReconnecting(false);
      push(ev('h3', 'handshake', Date.now()));
    });
    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    expect(screen.getAllByText('connection lost')).toHaveLength(1);
    expect(screen.getAllByText('reconnected')).toHaveLength(1);
  });
});

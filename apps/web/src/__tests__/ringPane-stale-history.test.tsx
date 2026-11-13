import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';

import {
  RingFeedContext,
  type RingFeedApi,
  type TrackedRingFeedEvent,
} from '../hooks/useRingFeed.js';
import RingPane from '../components/RingPane.js';

const listeners = new Set<(tracked: TrackedRingFeedEvent) => void>();
const mocks = vi.hoisted(() => ({ data: undefined as unknown[] | undefined, fresh: false, options: undefined as unknown }));

vi.mock('../hooks/useRingKeyTimestamps.js', () => ({
  useRingKeyTimestamps: () => ({ ringKeyTimestampsEnabled: false }),
}));
vi.mock('../hooks/useTimeAgo.js', () => ({ useTimeAgo: () => 'just now' }));
vi.mock('../utils/ring-feed-events.js', () => ({ shouldRenderRingEvent: () => true }));
vi.mock('../lib/trpc.js', () => ({
  trpc: {
    game: {
      ringHistory: {
        useQuery: (_input: unknown, options: unknown) => {
          mocks.options = options;
          return { data: mocks.data, isError: false, isFetchedAfterMount: mocks.fresh };
        },
      },
      recentFights: { useQuery: () => ({ data: [] }) },
      ringState: { useQuery: () => ({ data: undefined, refetch: () => Promise.resolve() }) },
    },
  },
}));

function TestFeed({ children }: { children: ReactNode }) {
  const value: RingFeedApi = {
    connected: true,
    reconnecting: false,
    seedCursor: () => undefined,
    subscribeChat: () => () => undefined,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  return <RingFeedContext.Provider value={value}>{children}</RingFeedContext.Provider>;
}

const row = (id: string, text: string) => ({
  id,
  roomId: 'room-1',
  timestamp: 1,
  type: 'announce',
  scope: 'public',
  text,
  payload: {},
});

const pane = () => (
  <TestFeed>
    <RingPane roomId="room-1" isActive />
  </TestFeed>
);

/**
 * react-query keeps a result for 5 minutes after the pane unmounts. With `staleTime: Infinity` a
 * quick return from another route handed the pane that cached snapshot, and since the feed's
 * first subscribe has no cursor (the server replays only its last 100 events) everything between
 * the snapshot's tail and those 100 was silently lost. The pane must apply only history fetched
 * after it mounted.
 */
describe('RingPane history after a quick return', () => {
  beforeEach(() => {
    listeners.clear();
    mocks.data = undefined;
    mocks.fresh = false;
  });

  it('fetches on every mount and never on focus or reconnect', () => {
    render(pane());
    expect(mocks.options).toEqual({
      staleTime: Infinity,
      refetchOnMount: 'always',
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    });
  });

  it('does not apply a cached result, then applies the refetched one', () => {
    mocks.data = [row('1-old', 'stale fight line')];
    mocks.fresh = false; // from the cache, before this mount
    const view = render(pane());
    expect(screen.queryByText(/stale fight line/)).toBeNull();
    expect(screen.queryByText('you joined here')).toBeNull();

    mocks.data = [row('1-old', 'stale fight line'), row('2-new', 'fresh fight line')];
    mocks.fresh = true; // the refetch resolved
    view.rerender(pane());
    expect(screen.getByText(/fresh fight line/)).toBeTruthy();
    expect(screen.getByText(/stale fight line/)).toBeTruthy();
  });
});

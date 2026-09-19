import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import {
  RingFeedContext,
  type RingFeedApi,
  type TrackedRingFeedEvent,
} from '../hooks/useRingFeed.js';
import RingPane from '../components/RingPane.js';

const listeners = new Set<(tracked: TrackedRingFeedEvent) => void>();

function pushEvent(tracked: TrackedRingFeedEvent) {
  for (const listener of listeners) listener(tracked);
}

vi.mock('../hooks/useRingKeyTimestamps.js', () => ({
  useRingKeyTimestamps: () => ({ ringKeyTimestampsEnabled: false }),
}));

vi.mock('../hooks/useTimeAgo.js', () => ({
  useTimeAgo: () => 'just now',
}));

// A stale contestant from the polled `ringState` query — as if fetched before, or
// mid-way through, the fight the live pushes below report on. Standing in for the
// query result a client would still be holding if it last refetched before the fight
// ended.
const staleQueryContestant = {
  name: 'Stale Snake',
  icon: '',
  creatureType: 'basilisk',
  level: 1,
  hp: 30,
  maxHp: 30,
  ac: 8,
  dead: false,
  isBoss: false,
  team: null,
  owner: 'Someone',
  userId: 'user-stale',
};

vi.mock('../lib/trpc.js', () => ({
  trpc: {
    game: {
      ringHistory: {
        useQuery: () => ({ data: [] }),
      },
      recentFights: {
        useQuery: () => ({ data: [] }),
      },
      ringState: {
        useQuery: () => ({
          data: {
            contestants: [staleQueryContestant],
            bossSummonsRemaining: 1,
            bossSummonLimit: 3,
          },
          refetch: () => Promise.resolve(),
        }),
      },
    },
  },
}));

vi.mock('../utils/ring-feed-events.js', () => ({
  shouldRenderRingEvent: () => true,
}));

vi.mock('react-virtuoso', () => {
  const React = require('react');
  return {
    Virtuoso: React.forwardRef(
      (
        props: {
          data?: Array<unknown>;
          itemContent?: (index: number, item: unknown) => React.ReactNode;
        },
        ref: React.Ref<{ scrollToIndex: () => void }>,
      ) => {
        React.useImperativeHandle(ref, () => ({ scrollToIndex: () => {} }));
        return (
          <div>
            {(props.data ?? []).map((item, index) => (
              <div key={index}>{props.itemContent?.(index, item) ?? null}</div>
            ))}
          </div>
        );
      },
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
      return () => {
        listeners.delete(listener);
      };
    },
  };
  return <RingFeedContext.Provider value={value}>{children}</RingFeedContext.Provider>;
}

describe('RingPane roster freshness at fight end', () => {
  it('shows the true final board on a live push, and does not fall back to a stale poll once the ring truly clears', () => {
    listeners.clear();
    render(
      <TestFeed>
        <RingPane roomId="room-123" isActive />
      </TestFeed>,
    );

    // Before any live ring.state has arrived, the roster seeds from the polled query.
    expect(screen.getByText('Stale Snake')).toBeInTheDocument();

    // A live push mid-fight reports the true board — the losing monster already dead.
    act(() => {
      pushEvent({
        id: 'ring-state-1',
        data: {
          id: 'event-ring-state-1',
          type: 'ring.state',
          scope: 'public',
          text: '',
          payload: {
            nextFightAt: null,
            nextBossSpawnAt: null,
            monsterCount: 2,
            inEncounter: true,
            contestants: [
              { ...staleQueryContestant, name: 'Anna', hp: 12, dead: false },
              { ...staleQueryContestant, name: 'Senyi', hp: 0, dead: true, userId: 'user-senyi' },
            ],
          },
          timestamp: Date.now(),
          roomId: 'room-123',
        },
      });
    });

    expect(screen.queryByText('Stale Snake')).not.toBeInTheDocument();
    expect(screen.getByText('Anna')).toBeInTheDocument();
    expect(screen.getByText('Senyi')).toBeInTheDocument();
    expect(screen.getByText(/1\/2 standing/)).toBeInTheDocument();

    // The fight concludes and the ring clears — the engine publishes an empty roster.
    // The roster must reflect that truly-empty ring rather than reverting to the
    // stale polled snapshot from before the fight even started.
    act(() => {
      pushEvent({
        id: 'ring-state-2',
        data: {
          id: 'event-ring-state-2',
          type: 'ring.state',
          scope: 'public',
          text: '',
          payload: {
            nextFightAt: null,
            nextBossSpawnAt: null,
            monsterCount: 0,
            inEncounter: false,
            contestants: [],
          },
          timestamp: Date.now(),
          roomId: 'room-123',
        },
      });
    });

    expect(screen.queryByText('Stale Snake')).not.toBeInTheDocument();
    expect(screen.queryByText('Anna')).not.toBeInTheDocument();
    expect(screen.queryByText(/standing/)).not.toBeInTheDocument();
  });
});

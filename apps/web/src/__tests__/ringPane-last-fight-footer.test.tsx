import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import {
  RingFeedContext,
  type RingFeedApi,
  type TrackedRingFeedEvent,
} from '../hooks/useRingFeed.js';
import RingPane from '../components/RingPane.js';

// What the recentFights query currently serves; the test swaps it as the server would.
const fights: { current: Array<Record<string, unknown>> } = { current: [] };
const summary = (fightNumber: number, title: string) => ({
  fightNumber,
  endedAt: new Date(0).toISOString(),
  title,
  contestants: [],
});

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
        useQuery: () => ({ data: fights.current }),
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
    subscribeChat: () => () => undefined,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
  return <RingFeedContext.Provider value={value}>{children}</RingFeedContext.Provider>;
}

const ringState = (inEncounter: boolean, id: string): TrackedRingFeedEvent => ({
  id,
  data: {
    id: `event-${id}`,
    type: 'ring.state',
    scope: 'public',
    text: '',
    payload: { nextFightAt: null, nextBossSpawnAt: null, monsterCount: 2, inEncounter, contestants: [] },
    timestamp: Date.now(),
    roomId: 'room-123',
  },
});

describe('RingPane last-fight footer (live check 49b, B2)', () => {
  it('keeps saying Previous fight after a fight ends, until that fight\'s summary arrives', () => {
    listeners.clear();
    fights.current = [summary(11, 'Akhazriel vs Fang')];
    const { rerender } = render(
      <TestFeed>
        <RingPane roomId="room-123" isActive />
      </TestFeed>,
    );
    expect(screen.getByText(/^Last fight:/)).toBeInTheDocument();

    act(() => pushEvent(ringState(true, 'rs-1')));
    expect(screen.getByText(/^Previous fight:/)).toBeInTheDocument();

    // The fight ends; the server has not written #12 yet, so #11 is still served.
    act(() => pushEvent(ringState(false, 'rs-2')));
    expect(screen.getByText(/^Previous fight:/)).toBeInTheDocument();

    fights.current = [summary(12, 'Kissirri vs Fang')];
    rerender(
      <TestFeed>
        <RingPane roomId="room-123" isActive />
      </TestFeed>,
    );
    expect(screen.getByText(/^Last fight:/)).toBeInTheDocument();
    expect(screen.getByText(/#12/)).toBeInTheDocument();
  });
});

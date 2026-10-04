import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import {
  RingFeedContext,
  type RingFeedApi,
  type TrackedRingFeedEvent,
} from '../hooks/useRingFeed.js';
import RingPane from '../components/RingPane.js';
import { SUMMONS_BADGE_TITLE } from '../components/ringHeaderBadges.js';

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
            contestants: [],
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

const base = {
  id: 'event-1',
  type: 'ring.state',
  scope: 'public',
  text: '',
  timestamp: Date.now(),
  roomId: 'room-123',
};

function push(payload: Record<string, unknown>) {
  act(() => {
    pushEvent({ id: 'ring-state-x', data: { ...base, payload } as never });
  });
}

describe('RingPane header badges around a standing boss', () => {
  it('shows the boss countdown while no boss stands, and hides it once one is in the ring', () => {
    listeners.clear();
    render(
      <TestFeed>
        <RingPane roomId="room-123" isActive />
      </TestFeed>,
    );
    const soon = Date.now() + 18 * 60_000;

    push({ nextFightAt: null, nextBossSpawnAt: soon, monsterCount: 0, inEncounter: false, contestants: [] });
    expect(screen.getByText(/boss in ~/)).toBeInTheDocument();

    // New-player walk 2 (#8): a countdown to "the next boss" beside a boss already standing.
    push({
      nextFightAt: null,
      nextBossSpawnAt: soon,
      monsterCount: 1,
      inEncounter: false,
      contestants: [{ ...staleQueryContestant, name: 'Razeth', isBoss: true, userId: null }],
    });
    expect(screen.queryByText(/boss in ~/)).not.toBeInTheDocument();
  });

  it('keeps the fight countdown and the mega boss badge while a boss stands', () => {
    listeners.clear();
    render(
      <TestFeed>
        <RingPane roomId="room-123" isActive />
      </TestFeed>,
    );
    const boss = { ...staleQueryContestant, name: 'Razeth', isBoss: true, userId: null };
    push({ nextFightAt: Date.now() + 60_000, nextBossSpawnAt: null, monsterCount: 1, inEncounter: false, contestants: [boss] });
    expect(screen.getByText(/fight in/)).toBeInTheDocument();
    push({ nextFightAt: null, nextMegaBossAt: Date.now() + 60_000, nextBossSpawnAt: null, monsterCount: 1, inEncounter: false, contestants: [boss] });
    expect(screen.getByText(/MEGA BOSS in/)).toBeInTheDocument();
  });

  it('titles the summons badge so a timer boss is not mistaken for a spent summon', () => {
    listeners.clear();
    render(
      <TestFeed>
        <RingPane roomId="room-123" isActive />
      </TestFeed>,
    );
    expect(screen.getByText('1 summon left')).toHaveAttribute('title', SUMMONS_BADGE_TITLE);
  });
});

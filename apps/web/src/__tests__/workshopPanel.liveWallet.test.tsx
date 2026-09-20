import { act, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { GameEvent } from '@deck-monsters/server/types';

type TrackedEvent = { id: string; data: GameEvent };

const subscriptionCalls: Array<{
  onData?: (tracked: TrackedEvent) => void;
}> = [];

const hookMock = vi.hoisted(() => ({
  monsters: [] as Array<Record<string, unknown>>,
  unequippedDeck: [] as string[],
  cardCompatibility: {},
  items: { character: [], monsters: [] },
  spawnOptions: { types: [{ index: 0, label: 'Basilisk' }], pronouns: [{ key: 'androgynous', label: 'they/them' }] },
  loading: false,
  busy: false,
  latestError: null as string | null,
  equipCards: vi.fn(), unequipCard: vi.fn(), unequipMany: vi.fn(), unequipAll: vi.fn(),
  moveCard: vi.fn(), moveMany: vi.fn(), reorderCards: vi.fn(), savePreset: vi.fn(),
  loadPreset: vi.fn(), deletePreset: vi.fn(), reviveMonster: vi.fn(), spawnMonster: vi.fn(),
  sendMonsterToRing: vi.fn(), roomName: 'Test Room',
  refresh: vi.fn(async () => undefined),
}));

vi.mock('../hooks/useDeckWorkshop.js', () => ({ useDeckWorkshop: () => hookMock }));

vi.mock('../lib/trpc.js', () => ({
  trpc: {
    game: {
      ringFeed: {
        useSubscription: (
          _input: unknown,
          opts: { onData?: (tracked: TrackedEvent) => void },
        ) => {
          subscriptionCalls.push({ onData: opts.onData });
        },
      },
    },
  },
}));

import WorkshopPanel from '../components/WorkshopPanel.js';
import { RingFeedProvider } from '../hooks/useRingFeed.js';

/**
 * Bug: "I still see only 0 coins in the workshop view." The wallet (and the rest of the
 * workshop) used to learn about a just-finished fight's coin reward only from a 30s poll.
 * `WorkshopPanel` now also listens on the shared `ring.xp` event (private, per-player,
 * emitted the instant `Game.awardFightCoins` runs) and refreshes immediately when one
 * arrives for this room — see the comment in WorkshopPanel.tsx for why `ring.xp` and not
 * some other event type.
 */
describe('WorkshopPanel: live wallet on ring.xp', () => {
  it('refreshes the workshop when a ring.xp event arrives over the shared feed', () => {
    subscriptionCalls.length = 0;
    hookMock.refresh.mockClear();

    render(
      <RingFeedProvider roomId="room-1">
        <WorkshopPanel roomId="room-1" />
      </RingFeedProvider>,
    );

    expect(subscriptionCalls).toHaveLength(1);
    const deliver = subscriptionCalls[0].onData!;

    act(() => {
      deliver({
        id: '1-0',
        data: {
          type: 'ring.xp',
          scope: 'private',
          roomId: 'room-1',
          targetUserId: 'user-1',
          text: 'You earned 5 coins.',
          payload: { coinsGained: 5 },
        } as unknown as GameEvent,
      });
    });

    expect(hookMock.refresh).toHaveBeenCalledTimes(1);
  });

  it('ignores unrelated event types, like a plain ring.fight tick', () => {
    subscriptionCalls.length = 0;
    hookMock.refresh.mockClear();

    render(
      <RingFeedProvider roomId="room-1">
        <WorkshopPanel roomId="room-1" />
      </RingFeedProvider>,
    );

    const deliver = subscriptionCalls[0].onData!;
    act(() => {
      deliver({
        id: '1-0',
        data: {
          type: 'ring.fight',
          scope: 'public',
          roomId: 'room-1',
          text: 'A fight breaks out!',
          payload: {},
        } as unknown as GameEvent,
      });
    });

    expect(hookMock.refresh).not.toHaveBeenCalled();
  });

  it('does not throw when rendered without a RingFeedProvider (the standalone workshop route today)', () => {
    subscriptionCalls.length = 0;
    expect(() => render(<WorkshopPanel roomId="room-1" />)).not.toThrow();
  });
});

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Roadmap 39a Part 1: the Train row (item 2), Free shop items (item 4) and the events that
// refresh the Workshop now that Sync is gone (item 3).
const freeItem = {
  stockIndex: 0, stockCount: 1, section: 'items' as const, displayName: 'Sorting Hat',
  description: 'Join a team.', stats: 'Usable 1 time.', price: 0, affordable: true, ownedCount: 0,
};
const pricedItem = { ...freeItem, stockIndex: 1, displayName: 'Bandage', price: 12 };

const monster = (name: string, extra: Record<string, unknown> = {}) => ({
  name, type: 'Gladiator', level: 1, xpIntoLevel: 0, xpNeededForLevel: 10, dead: false, inRing: false,
  inEncounter: false, cardSlots: 9, cards: [], presets: {}, hp: 10, maxHp: 10, revivesAt: null,
  battles: { wins: 0, losses: 0, total: 0 }, ...extra,
});

const hookMock = vi.hoisted(() => ({
  monsters: [] as Array<Record<string, unknown>>,
  unequippedDeck: [] as string[],
  cardCompatibility: {},
  items: { character: [], monsters: [] },
  hasCharacter: true as boolean | undefined,
  monsterSlots: 3 as number | undefined,
  shop: {
    name: 'Moon Market', adjective: 'gilded', closingTime: '2030-01-01T00:00:00.000Z', coins: 40,
    items: [] as unknown[], cards: [] as unknown[], backRoom: [] as unknown[], sellOffset: 0.8,
  },
  spawnOptions: { types: [{ index: 0, label: 'Basilisk' }], pronouns: [{ key: 'androgynous', label: 'they/them' }] },
  loading: false, busy: false, latestError: null as string | null,
  equipCards: vi.fn(), unequipCard: vi.fn(), unequipMany: vi.fn(), unequipAll: vi.fn(),
  moveCard: vi.fn(), moveMany: vi.fn(), reorderCards: vi.fn(), savePreset: vi.fn(),
  loadPreset: vi.fn(), deletePreset: vi.fn(), reviveMonster: vi.fn(), spawnMonster: vi.fn(),
  sendMonsterToRing: vi.fn(), roomName: 'Test Room', useItem: vi.fn(), sellShopItems: vi.fn(),
  buyShopItem: vi.fn(async (input: { expectedItemType: string }) => ({
    itemName: input.expectedItemType, price: input.expectedItemType === 'Sorting Hat' ? 0 : 12, remainingCoins: 28,
  })),
  refresh: vi.fn(async () => undefined),
}));

const feed = vi.hoisted(() => ({ onData: undefined as undefined | ((t: unknown) => void) }));

vi.mock('../hooks/useDeckWorkshop.js', () => ({ useDeckWorkshop: () => hookMock }));
vi.mock('../lib/trpc.js', () => ({
  trpc: {
    game: {
      ringFeed: {
        useSubscription: (_i: unknown, opts: { onData?: (t: unknown) => void }) => { feed.onData = opts.onData; },
      },
    },
  },
}));

// The guided-start box has its own tests (guidedStart.test.tsx); it needs auth, which these do not set up.
vi.mock('../hooks/useGuidedStart.js', () => ({
  useGuidedStart: () => ({ phase: 'hidden', name: '', slots: 0, dismiss: () => undefined }),
}));

import WorkshopPanel from '../components/WorkshopPanel.js';
import { RingFeedProvider } from '../hooks/useRingFeed.js';

beforeEach(() => {
  hookMock.monsters = [monster('Ash')];
  hookMock.hasCharacter = true;
  hookMock.monsterSlots = 3;
  hookMock.busy = false;
  hookMock.shop.items = [];
  hookMock.refresh.mockClear();
  hookMock.buyShopItem.mockClear();
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('WorkshopPanel: Train monster row', () => {
  it('makes Train monster the primary only while the player has no monsters', () => {
    hookMock.monsters = [];
    const { unmount } = render(<WorkshopPanel roomId="room-1" />);
    expect(screen.getByRole('button', { name: 'Train monster' })).toHaveClass('btn-primary');
    unmount();
    hookMock.monsters = [monster('Ash')];
    render(<WorkshopPanel roomId="room-1" />);
    expect(screen.getByRole('button', { name: 'Train monster' })).not.toHaveClass('btn-primary');
  });

  it('puts "You can train N more" beside the heading only while a place is free', () => {
    const { unmount } = render(<WorkshopPanel roomId="room-1" />);
    expect(document.querySelector('.workshop-title-row .workshop-train-count')?.textContent).toBe('You can train 2 more');
    unmount();
    hookMock.monsters = [monster('Ash'), monster('Bran'), monster('Cinder')];
    render(<WorkshopPanel roomId="room-1" />);
    expect(document.querySelector('.workshop-train-count')).toBeNull();
  });

  it('says how many more the player can train', () => {
    render(<WorkshopPanel roomId="room-1" />);
    expect(screen.getByText('Train a new monster to fight at your side. You can train 2 more.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Train monster' })).toBeEnabled();
  });

  it('says every place is taken when the roster is full, and disables the button', () => {
    hookMock.monsters = [monster('Ash'), monster('Bran'), monster('Cinder')];
    render(<WorkshopPanel roomId="room-1" />);
    expect(screen.getByText('Every place at your side is taken (3 monsters).')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Train monster' })).toBeDisabled();
  });

  it('uses the singular for a one-slot roster', () => {
    hookMock.monsters = [monster('Ash')];
    hookMock.monsterSlots = 1;
    render(<WorkshopPanel roomId="room-1" />);
    expect(screen.getByText('Every place at your side is taken (1 monster).')).toBeInTheDocument();
  });

  it('keeps Cancel usable when the roster fills while the training form is open', () => {
    hookMock.monsters = [monster('Ash')];
    hookMock.monsterSlots = 2;
    const { rerender } = render(<WorkshopPanel roomId="room-1" />);
    fireEvent.click(screen.getByRole('button', { name: 'Train monster' }));
    hookMock.monsters = [monster('Ash'), monster('Bran')];
    rerender(<WorkshopPanel roomId="room-1" />);
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeEnabled();
  });

  it('keeps the first-run behaviour for a player with no character: no count line', () => {
    hookMock.hasCharacter = false;
    hookMock.monsters = [];
    hookMock.monsterSlots = 0;
    render(<WorkshopPanel roomId="room-1" />);
    expect(screen.queryByText(/You can train/)).toBeNull();
    expect(screen.queryByText(/Every place/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Train monster' })).toBeEnabled();
  });

  it('shows no count line until the inventory reports monsterSlots', () => {
    hookMock.monsterSlots = undefined;
    render(<WorkshopPanel roomId="room-1" />);
    expect(screen.queryByText(/You can train/)).toBeNull();
  });
});

describe('WorkshopPanel: free shop items', () => {
  beforeEach(() => { hookMock.shop.items = [freeItem, pricedItem]; });

  it('asks "Take the ...? It\'s free." and reports "You took the ... It was free."', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<WorkshopPanel roomId="room-1" />);
    fireEvent.click(screen.getByRole('button', { name: 'Free' }));
    expect(confirmSpy).toHaveBeenCalledWith("Take the Sorting Hat? It's free.");
    expect(await screen.findByRole('status')).toHaveTextContent('You took the Sorting Hat. It was free.');
  });

  it('keeps the priced text for priced items', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<WorkshopPanel roomId="room-1" />);
    fireEvent.click(screen.getByRole('button', { name: '12 coins' }));
    expect(confirmSpy).toHaveBeenCalledWith('Buy Bandage for 12 coins?');
    expect(await screen.findByRole('status')).toHaveTextContent('Bought Bandage for 12 coins. 28 coins remain.');
  });
});

describe('WorkshopPanel: refresh without Sync', () => {
  it('refreshes when a ring.xp event arrives (a fight the player was in ended)', () => {
    render(
      <RingFeedProvider roomId="room-1"><WorkshopPanel roomId="room-1" /></RingFeedProvider>,
    );
    act(() => {
      feed.onData?.({ id: '1-0', data: { type: 'ring.xp', scope: 'private', roomId: 'room-1', text: 'x', payload: {} } });
    });
    expect(hookMock.refresh).toHaveBeenCalledTimes(1);
  });

  it('refreshes just after a running revival completes', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T12:00:00Z'));
    hookMock.monsters = [monster('Ash', { dead: true, hp: 0, revivesAt: Date.now() + 5_000 })];
    render(<WorkshopPanel roomId="room-1" />);
    act(() => vi.advanceTimersByTime(5_500));
    expect(hookMock.refresh).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(600));
    expect(hookMock.refresh).toHaveBeenCalledTimes(1);
  });
});

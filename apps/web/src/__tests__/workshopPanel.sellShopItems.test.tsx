import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

// Web selling (docs/roadmap/item-followups.md "Web selling") — the Workshop's Sell
// affordance needs the same explicit confirmation step the console's guided sell flow
// gives, before it hands the selection to `sellShopItems`.
const hookMock = vi.hoisted(() => ({
  monsters: [] as Array<Record<string, unknown>>,
  unequippedDeck: ['Blink'] as string[],
  cardCosts: { Blink: 15 },
  cardCompatibility: {},
  items: {
    character: [
      { displayName: 'Bandage', expired: false, stats: 'Usable 1 time.', usableOnMonsters: [], usableOnCharacter: false, cost: 10 },
    ],
    monsters: [],
  },
  shop: {
    name: 'Moon Market',
    adjective: 'gilded',
    closingTime: '2030-01-01T00:00:00.000Z',
    coins: 40,
    items: [],
    cards: [],
    backRoom: [],
    sellOffset: 0.8,
  },
  spawnOptions: { types: [{ index: 0, label: 'Basilisk' }], pronouns: [{ key: 'androgynous', label: 'they/them' }] },
  loading: false,
  busy: false,
  latestError: null as string | null,
  equipCards: vi.fn(), unequipCard: vi.fn(), unequipMany: vi.fn(), unequipAll: vi.fn(),
  moveCard: vi.fn(), moveMany: vi.fn(), reorderCards: vi.fn(), savePreset: vi.fn(),
  loadPreset: vi.fn(), deletePreset: vi.fn(), reviveMonster: vi.fn(), spawnMonster: vi.fn(),
  sendMonsterToRing: vi.fn(), roomName: 'Test Room',
  useItem: vi.fn(),
  buyShopItem: vi.fn(),
  sellShopItems: vi.fn(async () => ({ ok: true, totalValue: 16, remainingCoins: 56, sold: [] })),
  refresh: vi.fn(async () => undefined),
}));

vi.mock('../hooks/useDeckWorkshop.js', () => ({ useDeckWorkshop: () => hookMock }));

vi.mock('../lib/trpc.js', () => ({
  trpc: {
    game: {
      ringFeed: {
        useSubscription: () => undefined,
      },
    },
  },
}));

import WorkshopPanel from '../components/WorkshopPanel.js';

describe('WorkshopPanel: selling to the shop', () => {
  beforeEach(() => {
    hookMock.sellShopItems.mockClear();
  });

  it('asks for confirmation naming the item, quantity, and coins before selling', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<WorkshopPanel roomId="room-1" />);

    fireEvent.click(screen.getByRole('button', { name: 'Sell for 8 coins' }));

    expect(confirmSpy).toHaveBeenCalledWith('Sell Bandage for 8 coins?');
    expect(hookMock.sellShopItems).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it('sells the item once confirmed, and reports the result', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<WorkshopPanel roomId="room-1" />);

    fireEvent.click(screen.getByRole('button', { name: 'Sell for 8 coins' }));

    await waitFor(() =>
      expect(hookMock.sellShopItems).toHaveBeenCalledWith({
        expectedClosingTime: '2030-01-01T00:00:00.000Z',
        selections: [{ section: 'items', type: 'Bandage', count: 1 }],
      }),
    );
    expect(await screen.findByText('Sold Bandage for 16 coins. 56 coins remain.')).toBeInTheDocument();
    vi.restoreAllMocks();
  });

  it('sells an unequipped card the same way', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<WorkshopPanel roomId="room-1" />);

    // round(15 * 0.8) = 12 coins.
    fireEvent.click(screen.getByRole('button', { name: 'Sell for 12 coins' }));

    await waitFor(() =>
      expect(hookMock.sellShopItems).toHaveBeenCalledWith({
        expectedClosingTime: '2030-01-01T00:00:00.000Z',
        selections: [{ section: 'cards', type: 'Blink', count: 1 }],
      }),
    );
    vi.restoreAllMocks();
  });
});

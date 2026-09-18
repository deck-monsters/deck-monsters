import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const hookMock = vi.hoisted(() => ({
  monsters: [] as Array<Record<string, unknown>>,
  unequippedDeck: [] as string[],
  cardCompatibility: {},
  items: { character: [], monsters: [] },
  spawnOptions: { types: [{ index: 0, label: 'Basilisk' }], genders: ['androgynous'] },
  loading: false,
  busy: false,
  latestError: null as string | null,
  equipCards: vi.fn(), unequipCard: vi.fn(), unequipMany: vi.fn(), unequipAll: vi.fn(),
  moveCard: vi.fn(), moveMany: vi.fn(), reorderCards: vi.fn(), savePreset: vi.fn(),
  loadPreset: vi.fn(), deletePreset: vi.fn(), reviveMonster: vi.fn(), spawnMonster: vi.fn(),
  sendMonsterToRing: vi.fn(), refresh: vi.fn(), roomName: 'Test Room',
  shop: undefined as
    | { name: string; adjective: string; closingTime: string; coins: number; items: unknown[]; cards: unknown[]; backRoom: unknown[] }
    | undefined,
}));

vi.mock('../hooks/useDeckWorkshop.js', () => ({ useDeckWorkshop: () => hookMock }));

import WorkshopPanel from '../components/WorkshopPanel.js';

const makeShop = (coins: number) => ({
  name: 'Moon Market',
  adjective: 'gilded',
  closingTime: '2030-01-01T00:00:00.000Z',
  coins,
  items: [] as unknown[],
  cards: [] as unknown[],
  backRoom: [] as unknown[],
});

/**
 * Bug: "I still see only 0 coins in the workshop view." The wallet used to be visible only
 * inside the shop section, well below the monster row and inventory — a player checking
 * their balance right after a fight had to scroll past everything else to find it, and a
 * still-loading shop query briefly looked exactly like a genuine zero balance. Surfacing
 * the balance in the header fixes the visibility half of that report; the header wallet
 * only renders once `shop` (and therefore `shop.coins`) has actually loaded, so a loading
 * state never prints a misleading "0 coins". See docs/roadmap/10b-bugs-fixed.md.
 */
describe('workshop header wallet', () => {
  it('renders nothing in the header before the shop query resolves', () => {
    hookMock.shop = undefined;
    render(<WorkshopPanel roomId="room-1" />);
    expect(screen.queryByTitle('Coins')).not.toBeInTheDocument();
  });

  it('shows the live coin balance once the shop has loaded', () => {
    hookMock.shop = makeShop(42);
    render(<WorkshopPanel roomId="room-1" />);
    expect(screen.getByTitle('Coins')).toHaveTextContent('42 coins');
  });

  it('uses singular "coin" for a balance of exactly one', () => {
    hookMock.shop = makeShop(1);
    render(<WorkshopPanel roomId="room-1" />);
    expect(screen.getByTitle('Coins')).toHaveTextContent('1 coin');
    expect(screen.getByTitle('Coins')).not.toHaveTextContent('1 coins');
  });
});

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

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
  sendMonsterToRing: vi.fn(), refresh: vi.fn(), roomName: 'Test Room',
  shop: undefined as
    | { name: string; adjective: string; closingTime: string; coins: number; items: unknown[]; cards: unknown[]; backRoom: unknown[] }
    | undefined,
}));

vi.mock('../hooks/useDeckWorkshop.js', () => ({ useDeckWorkshop: () => hookMock }));

// The guided-start box has its own tests (guidedStart.test.tsx); it needs auth, which these do not set up.
vi.mock('../hooks/useGuidedStart.js', () => ({
  useGuidedStart: () => ({ phase: 'hidden', name: '', slots: 0, dismiss: () => undefined }),
}));

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
 * Coins live in the Shop only (roadmap 39a, Part 1 item 1). The Workshop header used to
 * carry the wallet beside "Train monster", and a new player read "196 coins" as the price
 * of levelling up the monster below. The balance is still shown, singular-aware, in the
 * Shop (ShopPanel.test.tsx).
 */
describe('workshop header has no wallet', () => {
  it('renders no coin balance in the header, before or after the shop loads', () => {
    hookMock.shop = undefined;
    const { unmount } = render(<WorkshopPanel roomId="room-1" />);
    expect(screen.queryByTitle('Coins')).not.toBeInTheDocument();
    unmount();

    hookMock.shop = makeShop(196);
    render(<WorkshopPanel roomId="room-1" />);
    expect(screen.queryByTitle('Coins')).not.toBeInTheDocument();
    const header = document.querySelector('.workshop-header') as HTMLElement;
    expect(header).not.toHaveTextContent(/\d+ coins?/);
  });

  it('shows the new subtitle and no Sync button', () => {
    hookMock.shop = makeShop(5);
    render(<WorkshopPanel roomId="room-1" />);
    expect(screen.getByText('Train monsters, choose their cards, and spend your coins.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sync' })).not.toBeInTheDocument();
  });
});

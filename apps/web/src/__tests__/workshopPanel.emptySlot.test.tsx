import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mk = (name: string) => ({
  name, type: 'Basilisk', level: 3, inRing: false, inEncounter: false, dead: false,
  cardSlots: 4, cards: [], presets: {},
  hp: 20, maxHp: 20, revivesAt: null as number | null, battles: { wins: 0, losses: 0, total: 0 },
});

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
}));

vi.mock('../hooks/useDeckWorkshop.js', () => ({ useDeckWorkshop: () => hookMock }));

// The guided-start box has its own tests (guidedStart.test.tsx); it needs auth, which these do not set up.
vi.mock('../hooks/useGuidedStart.js', () => ({
  useGuidedStart: () => ({ phase: 'hidden', name: '', slots: 0, dismiss: () => undefined }),
}));

import WorkshopPanel from '../components/WorkshopPanel.js';

/**
 * Bug 226: a new player taps an empty slot's [+] to add a card. With nothing selected that
 * tap did nothing; it now shows the cards that monster can use, like tapping its name.
 */
describe('tapping an empty monster slot with nothing selected', () => {
  beforeEach(() => {
    hookMock.monsters = [mk('Res'), mk('Fowl')];
    hookMock.unequippedDeck = ['Hit'];
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('filters Your cards for that monster and brings them into view', async () => {
    const raf = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(0);
      return 0;
    });
    render(<WorkshopPanel roomId="room-1" />);
    const fowlSlot = within(screen.getByRole('button', { name: 'Fowl' }).closest('section')!)
      .getAllByRole('button', { name: 'Empty slot' })[0]!;
    fireEvent.click(fowlSlot);
    expect(await screen.findByText('Inventory filtered for Fowl.')).toBeTruthy();
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
    raf.mockRestore();
  });

  it('keeps the filter on when tapped again, rather than toggling it off', async () => {
    render(<WorkshopPanel roomId="room-1" />);
    const section = screen.getByRole('button', { name: 'Res' }).closest('section')!;
    fireEvent.click(within(section).getAllByRole('button', { name: 'Empty slot' })[0]!);
    fireEvent.click(within(section).getAllByRole('button', { name: 'Empty slot' })[1]!);
    expect(await screen.findByText('Inventory filtered for Res.')).toBeTruthy();
  });
});

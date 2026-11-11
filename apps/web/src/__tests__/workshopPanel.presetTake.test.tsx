import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { planPresetTakes } from '../lib/presetTakes.js';

const mk = (name: string, over: Record<string, unknown> = {}) => ({
  name, type: 'Basilisk', level: 3, inRing: false, inEncounter: false, dead: false,
  cardSlots: 4, cards: [] as string[], presets: {} as Record<string, string[]>,
  hp: 20, maxHp: 20, revivesAt: null as number | null, battles: { wins: 0, losses: 0, total: 0 },
  ...over,
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
vi.mock('../hooks/useGuidedStart.js', () => ({
  useGuidedStart: () => ({ phase: 'hidden', name: '', slots: 0, dismiss: () => undefined }),
}));

import WorkshopPanel from '../components/WorkshopPanel.js';

const LOADED = {
  equippedCount: 3, requestedCount: 3, skippedCards: [] as string[], skipped: [] as unknown[],
  cardCount: 3, cardSlots: 4, taken: [] as unknown[], donors: [] as unknown[],
};

function stonefangSection() {
  return screen.getByRole('button', { name: 'Stonefang' }).closest('section')!;
}

function pickPreset(section: HTMLElement, name: string) {
  fireEvent.change(within(section).getByRole('combobox'), { target: { value: name } });
  fireEvent.click(within(section).getByRole('button', { name: 'Load' }));
}

describe('loading a preset that needs a card another monster holds', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hookMock.monsters = [
      mk('Stonefang', { cards: ['Heal'], presets: { raid: ['Hit', 'Hit', 'Blast'] } }),
      mk('Brass', { cards: ['Hit', 'Blast', 'Heal', 'Heal'] }),
    ];
    hookMock.unequippedDeck = ['Hit'];
    hookMock.loadPreset.mockResolvedValue(LOADED);
  });

  it('asks first, naming the cards and the monster that holds them, and does not load yet', () => {
    render(<WorkshopPanel roomId="room-1" />);
    pickPreset(stonefangSection(), 'raid');

    const question = within(stonefangSection()).getByRole('group');
    expect(question.textContent).toContain('Hit and Blast are on Brass. Take them from Brass for Stonefang?');
    expect(hookMock.loadPreset).not.toHaveBeenCalled();
  });

  it('moves focus to the first answer so the keyboard lands on the question', async () => {
    render(<WorkshopPanel roomId="room-1" />);
    pickPreset(stonefangSection(), 'raid');
    const yes = within(stonefangSection()).getByRole('button', { name: 'Yes, take them' });
    await waitFor(() => expect(document.activeElement).toBe(yes));
  });

  it('on yes, sends the explicit list and reports what the other monster is left with', async () => {
    hookMock.loadPreset.mockResolvedValue({
      ...LOADED,
      taken: [{ cardName: 'Hit', fromMonsterName: 'Brass' }, { cardName: 'Blast', fromMonsterName: 'Brass' }],
      donors: [{ monsterName: 'Brass', cardCount: 2, cardSlots: 4 }],
    });
    render(<WorkshopPanel roomId="room-1" />);
    pickPreset(stonefangSection(), 'raid');
    fireEvent.click(within(stonefangSection()).getByRole('button', { name: 'Yes, take them' }));

    await waitFor(() => expect(hookMock.loadPreset).toHaveBeenCalledTimes(1));
    expect(hookMock.loadPreset).toHaveBeenCalledWith({
      monsterName: 'Stonefang',
      presetName: 'raid',
      // The deck's own Hit is used first, so only one Hit comes off Brass.
      takeFrom: [{ monsterName: 'Brass', cardName: 'Hit', count: 1 }, { monsterName: 'Brass', cardName: 'Blast', count: 1 }],
    });
    expect(await screen.findByText(/Brass now holds 2 of 4 cards\. Fill the rest before the ring\./)).toBeTruthy();
  });

  it('on no, loads what the deck has and leaves the other monster alone (today\'s behaviour)', async () => {
    render(<WorkshopPanel roomId="room-1" />);
    pickPreset(stonefangSection(), 'raid');
    fireEvent.click(within(stonefangSection()).getByRole('button', { name: 'No, leave them' }));

    await waitFor(() => expect(hookMock.loadPreset).toHaveBeenCalledTimes(1));
    expect(hookMock.loadPreset).toHaveBeenCalledWith({ monsterName: 'Stonefang', presetName: 'raid' });
  });

  it('Cancel and Escape do nothing at all', () => {
    render(<WorkshopPanel roomId="room-1" />);
    pickPreset(stonefangSection(), 'raid');
    fireEvent.click(within(stonefangSection()).getByRole('button', { name: 'Cancel' }));
    expect(within(stonefangSection()).queryByRole('group')).toBeNull();

    pickPreset(stonefangSection(), 'raid');
    fireEvent.keyDown(within(stonefangSection()).getByRole('group'), { key: 'Escape' });
    expect(within(stonefangSection()).queryByRole('group')).toBeNull();
    expect(hookMock.loadPreset).not.toHaveBeenCalled();
  });

  it('does not ask when the deck covers the preset', async () => {
    hookMock.unequippedDeck = ['Hit', 'Hit', 'Blast'];
    render(<WorkshopPanel roomId="room-1" />);
    pickPreset(stonefangSection(), 'raid');
    expect(within(stonefangSection()).queryByRole('group')).toBeNull();
    await waitFor(() => expect(hookMock.loadPreset).toHaveBeenCalledWith({ monsterName: 'Stonefang', presetName: 'raid' }));
  });

  it('never offers a card held by a monster in the ring, and says why it was left', async () => {
    hookMock.monsters = [
      mk('Stonefang', { cards: [], presets: { raid: ['Blast'] } }),
      mk('Brass', { cards: ['Blast'], inRing: true }),
    ];
    hookMock.unequippedDeck = [];
    hookMock.loadPreset.mockResolvedValue({
      ...LOADED, equippedCount: 0, requestedCount: 1, skippedCards: ['Blast'],
      skipped: [{ cardName: 'Blast', reason: 'not_in_inventory' }], cardCount: 0,
    });
    render(<WorkshopPanel roomId="room-1" />);
    pickPreset(stonefangSection(), 'raid');

    expect(within(stonefangSection()).queryByRole('group')).toBeNull();
    await waitFor(() => expect(hookMock.loadPreset).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(/Brass is in the ring or fighting, so Blast could not be taken\./)).toBeTruthy();
  });
});

describe('planPresetTakes', () => {
  const base = { cardSlots: 9, inRing: false, inEncounter: false };
  const canHold = () => true;

  it('uses the deck and the monster\'s own old hand before anyone else', () => {
    const plan = planPresetTakes({
      monster: { name: 'A', cards: ['Hit'], ...base },
      presetCards: ['Hit', 'Hit', 'Blast'],
      monsters: [{ name: 'A', cards: ['Hit'], ...base }, { name: 'B', cards: ['Hit', 'Blast'], ...base }],
      unequippedDeck: ['Hit'],
      canHold,
    });
    expect(plan.takes).toEqual([{ cardName: 'Blast', fromMonsterName: 'B' }]);
  });

  it('stops at the copy limit and at a full hand, so it never offers a card the engine would skip', () => {
    const plan = planPresetTakes({
      monster: { name: 'A', cards: [], ...base },
      presetCards: ['Hit', 'Hit', 'Hit', 'Hit', 'Hit'],
      monsters: [{ name: 'A', cards: [], ...base }, { name: 'B', cards: ['Hit', 'Hit', 'Hit', 'Hit', 'Hit'], ...base }],
      unequippedDeck: [],
      canHold,
    });
    expect(plan.takes).toHaveLength(4);

    const full = planPresetTakes({
      monster: { name: 'A', cards: [], ...base, cardSlots: 1 },
      presetCards: ['Hit', 'Blast'],
      monsters: [{ name: 'A', cards: [], ...base, cardSlots: 1 }, { name: 'B', cards: ['Hit', 'Blast'], ...base }],
      unequippedDeck: [],
      canHold,
    });
    expect(full.takes).toEqual([{ cardName: 'Hit', fromMonsterName: 'B' }]);
  });

  it('does not offer a card the monster cannot hold, or one held by a fighting monster', () => {
    const plan = planPresetTakes({
      monster: { name: 'A', cards: [], ...base },
      presetCards: ['Blink', 'Blast'],
      monsters: [
        { name: 'A', cards: [], ...base },
        { name: 'B', cards: ['Blink'], ...base },
        { name: 'C', cards: ['Blast'], ...base, inEncounter: true },
      ],
      unequippedDeck: [],
      canHold: (cardName) => cardName !== 'Blink',
    });
    expect(plan.takes).toEqual([]);
    expect(plan.locked).toEqual([{ cardName: 'Blast', fromMonsterName: 'C' }]);
  });
});

import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const monster = {
  name: 'Saffron', type: 'Gladiator', level: 1, xpIntoLevel: 0, xpNeededForLevel: 10, dead: false, inRing: false,
  inEncounter: false, cardSlots: 5, cards: [], presets: {}, hp: 10, maxHp: 10, revivesAt: null,
  battles: { wins: 0, losses: 0, total: 0 },
};

const mocks = vi.hoisted(() => ({
  workshop: {
    monsters: [] as Array<Record<string, unknown>>,
    unequippedDeck: [] as string[],
    cardCompatibility: {},
    items: { character: [], monsters: [] },
    hasCharacter: true,
    monsterSlots: 3,
    shop: undefined,
    spawnOptions: { types: [{ index: 0, label: 'Basilisk' }], pronouns: [{ key: 'androgynous', label: 'they/them' }] },
    loading: false, busy: false, latestError: null,
    consoleFlowActive: false,
    equipCards: vi.fn(), unequipCard: vi.fn(), unequipMany: vi.fn(), unequipAll: vi.fn(), moveCard: vi.fn(),
    moveMany: vi.fn(), reorderCards: vi.fn(), savePreset: vi.fn(), loadPreset: vi.fn(), deletePreset: vi.fn(),
    reviveMonster: vi.fn(), spawnMonster: vi.fn(), sendMonsterToRing: vi.fn(), useItem: vi.fn(),
    refresh: vi.fn(async () => undefined),
  } as Record<string, unknown>,
  guide: { phase: 'equip', name: 'Saffron', slots: 5 } as { phase: string; name: string; slots: number },
}));

vi.mock('../hooks/useDeckWorkshop.js', () => ({ useDeckWorkshop: () => mocks.workshop }));
// The real box, a fixed phase: the hook itself is covered in guidedStart.test.tsx.
vi.mock('../hooks/useGuidedStart.js', () => ({
  useGuidedStart: () => ({ ...mocks.guide, dismiss: () => undefined }),
}));

import WorkshopPanel from '../components/WorkshopPanel.js';

const equipCopy = 'Give Saffron a full deck: tap an empty slot to add cards until all 5 are filled.';

describe('WorkshopPanel: guided start box', () => {
  beforeEach(() => {
    mocks.workshop.monsters = [monster];
    mocks.workshop.consoleFlowActive = false;
    mocks.guide = { phase: 'equip', name: 'Saffron', slots: 5 };
  });

  it('renders under the Train row and above the monsters for equip', () => {
    const { container } = render(<WorkshopPanel roomId="room-1" />);
    expect(screen.getByText(equipCopy)).toBeInTheDocument();
    const box = container.querySelector('.ftux-guide')!;
    const trainRow = container.querySelector('.workshop-train-row')!;
    const monsters = container.querySelector('.workshop-monster-row')!;
    expect(trainRow.compareDocumentPosition(box) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(box.compareDocumentPosition(monsters) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('does not render for spawn', () => {
    mocks.guide = { phase: 'spawn', name: '', slots: 0 };
    const { container } = render(<WorkshopPanel roomId="room-1" />);
    expect(container.querySelector('.ftux-guide')).toBeNull();
  });

  it('does not render while a Console flow is active', () => {
    mocks.workshop.consoleFlowActive = true;
    render(<WorkshopPanel roomId="room-1" />);
    expect(screen.queryByText(equipCopy)).toBeNull();
  });
});

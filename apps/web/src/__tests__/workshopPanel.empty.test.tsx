import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const hookMock = vi.hoisted(() => ({
  monsters: [] as Array<Record<string, unknown>>,
  unequippedDeck: ['Hit', 'Blast'],
  cardCompatibility: {},
  items: { character: [], monsters: [] },
  spawnOptions: {
    types: [{ index: 0, label: 'Basilisk' }, { index: 2, label: 'Jinn' }],
    genders: ['female', 'male', 'androgynous'],
  },
  loading: false,
  busy: false,
  latestError: null as string | null,
  equipCards: vi.fn(),
  unequipCard: vi.fn(),
  unequipMany: vi.fn(),
  unequipAll: vi.fn(),
  moveCard: vi.fn(),
  moveMany: vi.fn(),
  reorderCards: vi.fn(),
  savePreset: vi.fn(),
  loadPreset: vi.fn(),
  deletePreset: vi.fn(),
  reviveMonster: vi.fn(),
  spawnMonster: vi.fn(),
  sendMonsterToRing: vi.fn(),
  refresh: vi.fn(),
  roomName: 'Test Room',
}));

vi.mock('../hooks/useDeckWorkshop.js', () => ({
  useDeckWorkshop: () => hookMock,
}));

import WorkshopPanel from '../components/WorkshopPanel.js';

describe('WorkshopPanel: no monsters yet (#113)', () => {
  beforeEach(() => {
    hookMock.monsters = [];
    hookMock.loading = false;
    hookMock.busy = false;
    hookMock.latestError = null;
    hookMock.spawnMonster.mockReset();
  });

  /**
   * The monster row has no empty state of its own, so with zero monsters it collapsed to a
   * 6px strip of container-query padding — measured in Chromium at 393px. That reads as a
   * broken layout, and it is the first thing a brand-new player sees: a deck of cards with
   * nothing to put them on.
   */
  it('explains itself instead of collapsing to a sliver', () => {
    render(<WorkshopPanel roomId="room-1" />);
    expect(screen.getByText(/No monsters yet/i)).toBeTruthy();
  });

  it('names the command that gets you unstuck', () => {
    // An empty state that does not say what to do next is only half of one.
    render(<WorkshopPanel roomId="room-1" />);
    expect(screen.getByText('train a monster')).toBeTruthy();
  });

  it('trains a fully specified monster without opening a console flow', async () => {
    hookMock.spawnMonster.mockResolvedValue({ monsterName: 'Saffron', monsterType: 'Jinn' });
    render(<WorkshopPanel roomId="room-1" />);

    fireEvent.click(screen.getByRole('button', { name: 'Train monster' }));
    fireEvent.change(screen.getByLabelText('Type'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('Pronouns'), { target: { value: 'female' } });
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Saffron' } });
    fireEvent.change(screen.getByLabelText('Appearance'), { target: { value: 'violet smoke' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Train' }).closest('form')!);

    await waitFor(() => expect(hookMock.spawnMonster).toHaveBeenCalledWith({
      type: 2,
      gender: 'female',
      name: 'Saffron',
      color: 'violet smoke',
    }));
    expect(await screen.findByRole('status')).toHaveTextContent('Saffron the Jinn answers your call.');
    expect(screen.queryByLabelText('Name')).toBeNull();
  });

  it('shows a spawn refusal in the alert and leaves the form available to correct', async () => {
    hookMock.spawnMonster.mockRejectedValue(new Error('That monster name is already taken.'));
    render(<WorkshopPanel roomId="room-1" />);
    fireEvent.click(screen.getByRole('button', { name: 'Train monster' }));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Res' } });
    fireEvent.change(screen.getByLabelText('Appearance'), { target: { value: 'red' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Train' }).closest('form')!);

    expect(await screen.findByRole('alert')).toHaveTextContent('That monster name is already taken.');
    expect(screen.getByLabelText('Name')).toHaveValue('Res');
  });

  it('uses the authoritative spawn catalog instead of a client-side monster list', () => {
    render(<WorkshopPanel roomId="room-1" />);
    fireEvent.click(screen.getByRole('button', { name: 'Train monster' }));
    expect(screen.getByRole('option', { name: 'Jinn' })).toHaveValue('2');
  });

  it('does not render the monster row at all when it would be empty', () => {
    const { container } = render(<WorkshopPanel roomId="room-1" />);
    expect(container.querySelector('.workshop-monster-row')).toBeNull();
  });

  it('shows the row and no empty state once a monster exists', () => {
    hookMock.monsters = [
      {
        name: 'Stonefang',
        type: 'Basilisk',
        level: 3,
        inRing: false,
        inEncounter: false,
        dead: false,
        cardSlots: 2,
        cards: [],
        presets: {},
        hp: 20,
        maxHp: 20,
        revivesAt: null,
        battles: { wins: 0, losses: 0, total: 0 },
      },
    ];
    const { container } = render(<WorkshopPanel roomId="room-1" />);
    expect(container.querySelector('.workshop-monster-row')).toBeTruthy();
    expect(screen.queryByText(/No monsters yet/i)).toBeNull();
  });

  it('stays quiet while still loading, rather than flashing "no monsters"', () => {
    hookMock.loading = true;
    render(<WorkshopPanel roomId="room-1" />);
    expect(screen.queryByText(/No monsters yet/i)).toBeNull();
  });
});

describe('WorkshopPanel: only one monster in the ring at a time (#115)', () => {
  const monster = (name: string, inRing: boolean) => ({
    name,
    type: 'Basilisk',
    level: 3,
    inRing,
    inEncounter: false,
    dead: false,
    cardSlots: 1,
    cards: ['Hit'],
    presets: {},
    hp: 20,
    maxHp: 20,
    revivesAt: null as number | null,
    battles: { wins: 0, losses: 0, total: 0 },
  });

  /**
   * Beastmaster.sendMonsterToTheRing rejects on any contestant belonging to the character,
   * so one monster in the ring blocks every other. The button used to stay enabled, raise
   * a confirm dialog, and only then fail — asking the player to confirm something the
   * engine was always going to refuse.
   */
  it('disables send on a benched monster while a sibling is in the ring', () => {
    hookMock.monsters = [monster('Stonefang', true), monster('Emberclaw', false)];
    render(<WorkshopPanel roomId="room-1" />);

    const send = screen.getByRole('button', { name: 'Send to ring' });
    expect((send as HTMLButtonElement).disabled).toBe(true);
  });

  it('says which rule is stopping you', () => {
    hookMock.monsters = [monster('Stonefang', true), monster('Emberclaw', false)];
    render(<WorkshopPanel roomId="room-1" />);

    expect(screen.getByTitle(/only one at a time/i)).toBeTruthy();
  });

  it('enables send when nothing of yours is in the ring', () => {
    hookMock.monsters = [monster('Emberclaw', false)];
    render(<WorkshopPanel roomId="room-1" />);

    const send = screen.getByRole('button', { name: 'Send to ring' });
    expect((send as HTMLButtonElement).disabled).toBe(false);
  });

  it('still blocks an under-equipped monster, and says so', () => {
    hookMock.monsters = [{ ...monster('Emberclaw', false), cards: [], cardSlots: 2 }];
    render(<WorkshopPanel roomId="room-1" />);

    const send = screen.getByRole('button', { name: 'Send to ring' });
    expect((send as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTitle(/needs a full deck/i)).toBeTruthy();
  });
});

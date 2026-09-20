import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const hookMock = vi.hoisted(() => ({
  monsters: [] as Array<Record<string, unknown>>,
  unequippedDeck: [] as string[],
  cardCompatibility: {},
  items: { character: [], monsters: [] },
  hasCharacter: false as boolean,
  characterCreation: {
    genders: ['male', 'female', 'androgynous'],
    avatars: ['🦊', '🐙', '🦉'],
    suggestedName: 'Ada Lovelace',
  },
  shuffleAvatars: vi.fn(),
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

/**
 * Training a monster is a brand-new player's first action in the workshop, and it used to
 * fail with "Create your character before training a monster" — an instruction the
 * workshop gave no way to follow. The character's details now ride along with the spawn,
 * which is also why they have to be collected in this form: the mutation runs on a
 * prompt-free channel and cannot ask (docs/engine-concurrency-and-timing.md).
 */
describe('WorkshopPanel: first run with no character', () => {
  const fillSpawnFields = () => {
    fireEvent.change(screen.getByLabelText('Type'), { target: { value: '2' } });
    const pronounInputs = screen.getAllByLabelText('Pronouns');
    fireEvent.change(pronounInputs[pronounInputs.length - 1]!, { target: { value: 'female' } });
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Saffron' } });
    fireEvent.change(screen.getByLabelText('Appearance'), { target: { value: 'violet smoke' } });
  };

  beforeEach(() => {
    hookMock.monsters = [];
    hookMock.hasCharacter = false;
    hookMock.loading = false;
    hookMock.busy = false;
    hookMock.latestError = null;
    hookMock.spawnMonster.mockReset();
    hookMock.shuffleAvatars.mockReset();
    hookMock.spawnMonster.mockResolvedValue({ monsterName: 'Saffron', monsterType: 'Jinn' });
  });

  it('says the workshop will create the character, instead of only counting monsters', () => {
    render(<WorkshopPanel roomId="room-1" />);
    expect(
      screen.getByText(
        "You don't have a character in this room yet. Train your first monster and we'll create one for you.",
      ),
    ).toBeTruthy();
  });

  it('asks who you are above the monster fields', () => {
    render(<WorkshopPanel roomId="room-1" />);
    fireEvent.click(screen.getByRole('button', { name: 'Train monster' }));

    expect(screen.getByRole('group', { name: 'About you' })).toBeTruthy();
    expect(screen.getByLabelText('Your name')).toHaveValue('Ada Lovelace');
    expect(screen.getByLabelText('Pronouns')).toHaveValue('androgynous');
    expect(screen.getByRole('radio', { name: '🦊' })).toBeChecked();
  });

  it('labels the pronoun options in words while keeping the engine keys as values', () => {
    render(<WorkshopPanel roomId="room-1" />);
    fireEvent.click(screen.getByRole('button', { name: 'Train monster' }));
    const characterFields = within(screen.getByRole('group', { name: 'About you' }));

    expect(characterFields.getByRole('option', { name: 'she/her' })).toHaveValue('female');
    expect(characterFields.getByRole('option', { name: 'he/him' })).toHaveValue('male');
    expect(characterFields.getByRole('option', { name: 'they/them' })).toHaveValue('androgynous');
  });

  it('sends the character with the spawn, so onboarding is one submit', async () => {
    render(<WorkshopPanel roomId="room-1" />);
    fireEvent.click(screen.getByRole('button', { name: 'Train monster' }));
    fillSpawnFields();
    fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Ada' } });
    fireEvent.change(screen.getAllByLabelText('Pronouns')[0]!, { target: { value: 'female' } });
    fireEvent.click(screen.getByRole('radio', { name: '🐙' }));
    fireEvent.submit(screen.getByRole('button', { name: 'Train' }).closest('form')!);

    await waitFor(() => expect(hookMock.spawnMonster).toHaveBeenCalledWith({
      type: 2,
      gender: 'female',
      name: 'Saffron',
      color: 'violet smoke',
      character: { name: 'Ada', gender: 'female', avatar: '🐙' },
    }));
    expect(await screen.findByRole('status')).toHaveTextContent('Saffron the Jinn answers your call.');
  });

  it('offers a different set of avatars without losing the rest of the form', () => {
    render(<WorkshopPanel roomId="room-1" />);
    fireEvent.click(screen.getByRole('button', { name: 'Train monster' }));
    fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Ada' } });
    fireEvent.click(screen.getByRole('button', { name: 'Shuffle' }));

    expect(hookMock.shuffleAvatars).toHaveBeenCalled();
    expect(screen.getByLabelText('Your name')).toHaveValue('Ada');
    expect(hookMock.spawnMonster).not.toHaveBeenCalled();
  });

  it('leaves the form exactly as it was for a player who already has a character', async () => {
    hookMock.hasCharacter = true;
    render(<WorkshopPanel roomId="room-1" />);
    fireEvent.click(screen.getByRole('button', { name: 'Train monster' }));

    expect(screen.queryByRole('group', { name: 'About you' })).toBeNull();
    expect(screen.queryByLabelText('Your name')).toBeNull();

    fillSpawnFields();
    fireEvent.submit(screen.getByRole('button', { name: 'Train' }).closest('form')!);

    await waitFor(() => expect(hookMock.spawnMonster).toHaveBeenCalledWith({
      type: 2,
      gender: 'female',
      name: 'Saffron',
      color: 'violet smoke',
    }));
  });

  it('keeps the monster-focused empty state for a player who has a character', () => {
    hookMock.hasCharacter = true;
    render(<WorkshopPanel roomId="room-1" />);

    expect(screen.getByText(/No monsters yet/i)).toBeTruthy();
    expect(screen.queryByText(/don't have a character in this room yet/i)).toBeNull();
  });
});

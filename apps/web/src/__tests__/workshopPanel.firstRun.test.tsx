import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const hookMock = vi.hoisted(() => ({
  monsters: [] as Array<Record<string, unknown>>,
  unequippedDeck: [] as string[],
  cardCompatibility: {},
  items: { character: [], monsters: [] },
  hasCharacter: false as boolean,
  characterCreation: {
    pronouns: [
      { key: 'male', label: 'he/him' },
      { key: 'female', label: 'she/her' },
      { key: 'androgynous', label: 'they/them' },
    ],
    avatars: ['🦊', '🐙', '🦉'],
    suggestedName: 'Ada Lovelace',
  },
  shuffleAvatars: vi.fn(),
  spawnOptions: {
    types: [
      { index: 0, label: 'Basilisk', summary: 'A hard-hitting serpent that coils around its foes and grows a thicker skin.', class: 'Barbarian', signatureCard: 'Coil' },
      { index: 2, label: 'Jinn', summary: 'A trickster spirit that stirs up sandstorms and turns the fight with clever magic.', class: 'Cleric', signatureCard: 'Sandstorm' },
    ],
    pronouns: [
      { key: 'male', label: 'he/him' },
      { key: 'female', label: 'she/her' },
      { key: 'androgynous', label: 'they/them' },
    ],
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
  suggestMonsterNames: vi.fn(),
  sendMonsterToRing: vi.fn(),
  refresh: vi.fn(),
  roomName: 'Test Room',
}));

vi.mock('../hooks/useDeckWorkshop.js', () => ({
  useDeckWorkshop: () => hookMock,
}));

// The guided-start box has its own tests (guidedStart.test.tsx); it needs auth, which these do not set up.
vi.mock('../hooks/useGuidedStart.js', () => ({
  useGuidedStart: () => ({ phase: 'hidden', name: '', slots: 0, dismiss: () => undefined }),
}));

import WorkshopPanel from '../components/WorkshopPanel.js';

/**
 * Training a monster is a brand-new player's first action in the workshop, and it used to
 * fail with "Create your character before training a monster" — an instruction the
 * workshop gave no way to follow. The character's details now ride along with the spawn,
 * which is also why they have to be collected in this form: the mutation runs on a
 * prompt-free channel and cannot ask (docs/architecture/engine-concurrency-and-timing.md).
 */
describe('WorkshopPanel: first run with no character', () => {
  const next = () => fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  /** Walks the wizard from the Type step to Ready: a Jinn, she/her, Saffron, violet smoke. */
  const fillSpawnFields = () => {
    fireEvent.click(screen.getByRole('radio', { name: /Jinn/ }));
    next();
    fireEvent.click(screen.getByRole('radio', { name: 'she/her' }));
    next();
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Saffron' } });
    next();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'violet smoke' } });
    next();
  };

  beforeEach(() => {
    hookMock.monsters = [];
    hookMock.hasCharacter = false;
    hookMock.loading = false;
    hookMock.busy = false;
    hookMock.latestError = null;
    hookMock.spawnMonster.mockReset();
    hookMock.shuffleAvatars.mockReset();
    hookMock.suggestMonsterNames.mockReset();
    hookMock.suggestMonsterNames.mockResolvedValue({ names: ['Vesper', 'Ember'] });
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

    expect(screen.getByRole('heading', { name: 'About you' })).toBeTruthy();
    expect(screen.getByText('Step 1 of 6')).toBeTruthy();
    expect(screen.getByLabelText('Your name')).toHaveValue('Ada Lovelace');
    expect(screen.getByLabelText('Pronouns')).toHaveValue('androgynous');
    expect(screen.getByRole('option', { name: 'she/her' })).toHaveValue('female');
    expect(screen.getByRole('radio', { name: '🦊' })).toBeChecked();
  });

  it('sends the character with the spawn, so onboarding is one submit', async () => {
    render(<WorkshopPanel roomId="room-1" />);
    fireEvent.click(screen.getByRole('button', { name: 'Train monster' }));
    fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Ada' } });
    fireEvent.change(screen.getByLabelText('Pronouns'), { target: { value: 'female' } });
    fireEvent.click(screen.getByRole('radio', { name: '🐙' }));
    next();
    fillSpawnFields();
    fireEvent.click(screen.getByRole('button', { name: 'Train Saffron' }));

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

    expect(screen.queryByRole('heading', { name: 'About you' })).toBeNull();
    expect(screen.queryByLabelText('Your name')).toBeNull();
    expect(screen.getByText('Step 1 of 5')).toBeTruthy();

    fillSpawnFields();
    fireEvent.click(screen.getByRole('button', { name: 'Train Saffron' }));

    await waitFor(() => expect(hookMock.spawnMonster).toHaveBeenCalledWith({
      type: 2,
      gender: 'female',
      name: 'Saffron',
      color: 'violet smoke',
    }));
  });

  it('returns to the Name step when the server says the name is taken, and keeps the wizard open', async () => {
    hookMock.hasCharacter = true;
    hookMock.spawnMonster.mockRejectedValue(new Error('That monster name is already taken.'));
    render(<WorkshopPanel roomId="room-1" />);
    fireEvent.click(screen.getByRole('button', { name: 'Train monster' }));
    fillSpawnFields();
    fireEvent.click(screen.getByRole('button', { name: 'Train Saffron' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('That monster name is already taken.');
    expect(screen.getByRole('heading', { name: 'Name' })).toBeTruthy();
    expect(screen.getByLabelText('Name')).toHaveValue('Saffron');
  });

  it('asks the server for name suggestions for the chosen type and pronouns', async () => {
    hookMock.hasCharacter = true;
    render(<WorkshopPanel roomId="room-1" />);
    fireEvent.click(screen.getByRole('button', { name: 'Train monster' }));
    fireEvent.click(screen.getByRole('radio', { name: /Jinn/ }));
    next();
    fireEvent.click(screen.getByRole('radio', { name: 'she/her' }));
    next();
    fireEvent.click(await screen.findByRole('button', { name: 'Vesper' }));

    expect(hookMock.suggestMonsterNames).toHaveBeenCalledWith({ type: 2, gender: 'female' });
    expect(screen.getByLabelText('Name')).toHaveValue('Vesper');
  });

  it('keeps the monster-focused empty state for a player who has a character', () => {
    hookMock.hasCharacter = true;
    render(<WorkshopPanel roomId="room-1" />);

    expect(screen.getByText(/No monsters yet/i)).toBeTruthy();
    expect(screen.queryByText(/don't have a character in this room yet/i)).toBeNull();
  });
});

import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const monster = (name: string) => ({
  name,
  type: 'Jinn',
  level: 1,
  inRing: false,
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

const usableItem = {
  displayName: 'Chaos Theory for Beginners',
  expired: false,
  stats: 'Usable 3 times.',
  usableOnMonsters: ['Saffron'],
  usableOnCharacter: false,
};

const hookMock = vi.hoisted(() => ({
  monsters: [] as Array<Record<string, unknown>>,
  unequippedDeck: [] as string[],
  cardCompatibility: {},
  items: { character: [] as unknown[], monsters: [] as unknown[] },
  spawnOptions: { types: [], pronouns: [] },
  hasCharacter: true,
  loading: false,
  busy: false,
  consoleFlowActive: false,
  latestError: null as string | null,
  equipCards: vi.fn(), unequipCard: vi.fn(), unequipMany: vi.fn(), unequipAll: vi.fn(),
  moveCard: vi.fn(), moveMany: vi.fn(), reorderCards: vi.fn(), savePreset: vi.fn(),
  loadPreset: vi.fn(), deletePreset: vi.fn(), reviveMonster: vi.fn(), spawnMonster: vi.fn(),
  sendMonsterToRing: vi.fn(), refresh: vi.fn(), roomName: 'Test Room',
  useItem: vi.fn(),
}));

vi.mock('../hooks/useDeckWorkshop.js', () => ({ useDeckWorkshop: () => hookMock }));

import WorkshopPanel from '../components/WorkshopPanel.js';

/**
 * The console/Discord path always told the player what an item did; the web Workshop
 * showed only a generic "Used X." because `useItem` discarded the engine's own narration.
 * See docs/architecture/workshop-and-items.md and docs/roadmap/item-followups.md
 * ("Outcome feedback").
 */
describe('WorkshopPanel item use narration', () => {
  beforeEach(() => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    hookMock.monsters = [monster('Saffron')];
    hookMock.items = { character: [usableItem], monsters: [] };
    hookMock.useItem.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows the engine's own narration instead of the generic message", async () => {
    hookMock.useItem.mockResolvedValue({
      ok: true,
      applied: true,
      itemName: 'Chaos Theory for Beginners',
      monsterName: 'Saffron',
      announcements: [
        'Saffron learns new tactics from a 📜 well-worn scroll entitled _Chaos Theory for Beginners_.\n\n' +
          'From now on Saffron will look around the ring and pick a random foe to target, unless directed otherwise by a specific card.',
      ],
    });

    render(<WorkshopPanel roomId="room-1" />);
    fireEvent.click(screen.getByRole('button', { name: /Use Chaos Theory for Beginners on Saffron/i }));

    const status = await screen.findByRole('status');
    expect(status).toHaveTextContent('will look around the ring and pick a random foe to target');
    // The generic message must not still be shown alongside/instead of the narration.
    expect(status.textContent).not.toContain('Used Chaos Theory for Beginners on Saffron.');
  });

  it('joins multiple engine announcements for one use', async () => {
    hookMock.useItem.mockResolvedValue({
      ok: true,
      applied: true,
      itemName: 'Chaos Theory for Beginners',
      monsterName: 'Saffron',
      announcements: ['First line of narration.', 'Second line of narration.'],
    });

    render(<WorkshopPanel roomId="room-1" />);
    fireEvent.click(screen.getByRole('button', { name: /Use Chaos Theory for Beginners on Saffron/i }));

    const status = await screen.findByRole('status');
    expect(status).toHaveTextContent('First line of narration.');
    expect(status).toHaveTextContent('Second line of narration.');
  });

  it('falls back to the generic message when the engine narrated nothing on this channel', async () => {
    hookMock.useItem.mockResolvedValue({
      ok: true,
      applied: true,
      itemName: 'Chaos Theory for Beginners',
      monsterName: 'Saffron',
      announcements: [],
    });

    render(<WorkshopPanel roomId="room-1" />);
    fireEvent.click(screen.getByRole('button', { name: /Use Chaos Theory for Beginners on Saffron/i }));

    expect(await screen.findByRole('status')).toHaveTextContent('Used Chaos Theory for Beginners on Saffron.');
  });

  it('still reports no effect when the item declined, even if announcements is missing', async () => {
    // Response shapes from an older server build (or a mid-rollout mismatch) may omit the
    // new field entirely; the applied:false branch must not depend on it being present.
    hookMock.useItem.mockResolvedValue({
      ok: true,
      applied: false,
      itemName: 'Chaos Theory for Beginners',
      monsterName: 'Saffron',
    });

    render(<WorkshopPanel roomId="room-1" />);
    fireEvent.click(screen.getByRole('button', { name: /Use Chaos Theory for Beginners on Saffron/i }));

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Chaos Theory for Beginners had no effect on Saffron right now — it was not used up.',
    );
  });
});

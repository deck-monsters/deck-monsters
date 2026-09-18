import { fireEvent, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mk = (name: string) => ({
  name, type: 'Basilisk', level: 3, inRing: false, inEncounter: false, dead: false,
  cardSlots: 4, cards: [], presets: {},
});

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
}));

vi.mock('../hooks/useDeckWorkshop.js', () => ({ useDeckWorkshop: () => hookMock }));

import WorkshopPanel from '../components/WorkshopPanel.js';

/**
 * Below 900px the monster row is a scroll-snapped carousel: one panel plus a ~44px sliver
 * of the next. The sliver was the only signal that other monsters existed, and cut
 * mid-word it read as a rendering fault rather than an affordance.
 */
describe('workshop monster carousel dots', () => {
  beforeEach(() => {
    hookMock.monsters = [];
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('shows one dot per monster', () => {
    hookMock.monsters = [mk('Res'), mk('Fowl'), mk('Grix')];
    render(<WorkshopPanel roomId="room-1" />);
    expect(screen.getAllByRole('tab')).toHaveLength(3);
  });

  it('names each dot after its monster rather than a position number', () => {
    // "2 of 3" tells you nothing about which monster you are jumping to.
    hookMock.monsters = [mk('Res'), mk('Fowl')];
    render(<WorkshopPanel roomId="room-1" />);
    expect(screen.getByRole('tab', { name: 'Fowl' })).toBeTruthy();
  });

  it('marks the first monster selected before any scrolling', () => {
    hookMock.monsters = [mk('Res'), mk('Fowl')];
    render(<WorkshopPanel roomId="room-1" />);
    expect(screen.getByRole('tab', { name: 'Res' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tab', { name: 'Fowl' }).getAttribute('aria-selected')).toBe('false');
  });

  it('scrolls the chosen monster into view when a dot is tapped', () => {
    hookMock.monsters = [mk('Res'), mk('Fowl')];
    render(<WorkshopPanel roomId="room-1" />);
    fireEvent.click(screen.getByRole('tab', { name: 'Fowl' }));
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });

  it('renders no dots for a single monster — there is nothing to page through', () => {
    hookMock.monsters = [mk('Res')];
    render(<WorkshopPanel roomId="room-1" />);
    expect(screen.queryAllByRole('tab')).toHaveLength(0);
  });

  it('renders no dots with no monsters, where the empty state shows instead', () => {
    render(<WorkshopPanel roomId="room-1" />);
    expect(screen.queryAllByRole('tab')).toHaveLength(0);
  });
});

describe('dots appear only where the row actually scrolls', () => {
  const css = readFileSync(join(process.cwd(), 'src/styles/base.css'), 'utf8');

  it('are hidden by default, since the wide layout shows every panel at once', () => {
    expect(css).toMatch(/\.workshop-monster-dots\s*\{[^}]*display:\s*none/);
  });

  it('turn on inside the same container query that makes the row a carousel', () => {
    const carousel = css.slice(
      css.indexOf('@container workshop (max-width: 900px)'),
      css.indexOf('@container workshop (max-width: 520px)')
    );
    expect(carousel).toMatch(/\.workshop-monster-row\s*\{[^}]*overflow-x:\s*auto/);
    expect(carousel).toMatch(/\.workshop-monster-dots\s*\{\s*display:\s*flex/);
  });
});

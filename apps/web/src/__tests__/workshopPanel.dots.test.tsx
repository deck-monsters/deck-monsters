import { fireEvent, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
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

import WorkshopPanel, { resetWorkshopPeekForTests } from '../components/WorkshopPanel.js';

/**
 * Below 900px the monster row is a scroll-snapped carousel: one panel plus a sliver of the
 * next. The sliver alone read as a rendering fault (10b #122), and pass 43 I1 stacked the
 * row instead; #224 restored the carousel with larger dots, a next arrow and a peek on load.
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
    expect(screen.queryByRole('button', { name: 'Next monster' })).toBeNull();
  });
});

describe('workshop monster carousel next arrow', () => {
  beforeEach(() => {
    hookMock.monsters = [];
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('sits outside the tablist, since a "next" button is not a tab', () => {
    hookMock.monsters = [mk('Res'), mk('Fowl')];
    render(<WorkshopPanel roomId="room-1" />);
    const next = screen.getByRole('button', { name: 'Next monster' });
    expect(next.closest('[role="tablist"]')).toBeNull();
  });

  it('scrolls the second monster into view from the first', () => {
    hookMock.monsters = [mk('Res'), mk('Fowl'), mk('Grix')];
    render(<WorkshopPanel roomId="room-1" />);
    const scroll = vi.fn();
    const panels = document.querySelector('.workshop-monster-row')!.children;
    (panels[1] as HTMLElement).scrollIntoView = scroll;
    fireEvent.click(screen.getByRole('button', { name: 'Next monster' }));
    expect(scroll).toHaveBeenCalled();
  });

  it('is disabled on the last monster, where there is no next', () => {
    hookMock.monsters = [mk('Res'), mk('Fowl')];
    render(<WorkshopPanel roomId="room-1" />);
    const row = document.querySelector('.workshop-monster-row') as HTMLElement;
    // jsdom has no layout: put the second panel at the row's left edge by hand.
    Object.defineProperty(row.children[0], 'offsetLeft', { value: -300 });
    Object.defineProperty(row.children[1], 'offsetLeft', { value: 0 });
    fireEvent.scroll(row);
    expect((screen.getByRole('button', { name: 'Next monster' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole('tab', { name: 'Fowl' }).getAttribute('aria-selected')).toBe('true');
  });
});

describe('workshop monster carousel peek', () => {
  const overflow = (scrollWidth: number, clientWidth: number) => {
    vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(scrollWidth);
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(clientWidth);
  };
  const row = () => document.querySelector('.workshop-monster-row') as HTMLElement;

  beforeEach(() => {
    vi.restoreAllMocks();
    resetWorkshopPeekForTests();
    hookMock.monsters = [mk('Res'), mk('Fowl')];
  });

  it('peeks when the row overflows, so the next monster shows itself', () => {
    overflow(800, 390);
    render(<WorkshopPanel roomId="room-1" />);
    expect(row().classList.contains('peek')).toBe(true);
  });

  it('does not peek where every panel is already visible', () => {
    overflow(800, 800);
    render(<WorkshopPanel roomId="room-1" />);
    expect(row().classList.contains('peek')).toBe(false);
  });

  it('does not peek with one monster', () => {
    overflow(800, 390);
    hookMock.monsters = [mk('Res')];
    render(<WorkshopPanel roomId="room-1" />);
    expect(row().classList.contains('peek')).toBe(false);
  });

  it('peeks once per page load, not on every visit to the Workshop', () => {
    overflow(800, 390);
    const first = render(<WorkshopPanel roomId="room-1" />);
    first.unmount();
    render(<WorkshopPanel roomId="room-1" />);
    expect(row().classList.contains('peek')).toBe(false);
  });

  it('stops as soon as the player grabs the row', () => {
    overflow(800, 390);
    render(<WorkshopPanel roomId="room-1" />);
    fireEvent.pointerDown(row());
    expect(row().classList.contains('peek')).toBe(false);
  });
});

describe('carousel CSS (jsdom has no layout, so this guards the stylesheet)', () => {
  const css = readFileSync(join(process.cwd(), 'src/styles/base.css'), 'utf8');

  it('is a wrapping grid by default, since the wide layout shows every panel at once', () => {
    expect(css).toMatch(/\.workshop-monster-row\s*\{[^}]*display:\s*grid[^}]*auto-fit/);
    expect(css).toMatch(/\.workshop-monster-nav\s*\{[^}]*display:\s*none/);
  });

  it('turns into a carousel, with its dots, inside the phone container query', () => {
    const carousel = css.slice(
      css.indexOf('@container workshop (max-width: 900px)'),
      css.indexOf('@container workshop (max-width: 520px)')
    );
    expect(carousel).toMatch(/\.workshop-monster-row\s*\{[^}]*overflow-x:\s*auto/);
    expect(carousel).toMatch(/scroll-snap-type:\s*inline mandatory/);
    expect(carousel).toMatch(/\.workshop-monster-nav\s*\{\s*display:\s*flex/);
  });

  it('draws 10px dot markers (#224: 8px went unnoticed on a phone)', () => {
    expect(css).toMatch(/\.workshop-monster-dot::before\s*\{[^}]*width:\s*10px[^}]*height:\s*10px/);
  });

  it('animates the panels, not the scrolling row, and not under reduced motion', () => {
    expect(css).toMatch(/\.workshop-monster-row\.peek > \.workshop-monster-panel\s*\{[^}]*animation:\s*workshop-monster-peek/);
    expect(css).toMatch(/prefers-reduced-motion: reduce\)\s*\{\s*\.workshop-monster-row\.peek > \.workshop-monster-panel\s*\{\s*animation:\s*none/);
  });
});

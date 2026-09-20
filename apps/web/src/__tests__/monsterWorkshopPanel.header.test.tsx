import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import MonsterWorkshopPanel from '../components/MonsterWorkshopPanel.js';

const baseMonster = {
  name: 'Stonefang',
  type: 'Gladiator',
  level: 0,
  xpIntoLevel: 14,
  xpNeededForLevel: 28,
  dead: false,
  inRing: false,
  inEncounter: false,
  cardSlots: 9,
  cards: [] as string[],
  presets: {},
  hp: 30,
  maxHp: 30,
  revivesAt: null as number | null,
  battles: { wins: 0, losses: 0, total: 0 },
};

const noop = () => undefined;
const NOW = Date.UTC(2026, 0, 1, 12, 0, 0);
const MINUTE = 60_000;

function renderPanel(overrides: Partial<typeof baseMonster> = {}) {
  return render(
    <MonsterWorkshopPanel
      monster={{ ...baseMonster, ...overrides }}
      showSelectionHint={false}
      selectedCards={[]}
      onDropCard={noop}
      onTapSlot={noop}
      onSelectCard={noop}
      onUnequipAll={noop}
      onRevive={noop}
      onSendToRing={noop}
      onSavePreset={noop}
      onLoadPreset={noop}
      onDeletePreset={noop}
    />,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('MonsterWorkshopPanel header — HP first, no slot bar (10b-bugs-fixed.md HP-not-shown)', () => {
  it('shows current HP as the primary meter, with accessible values', () => {
    renderPanel({ hp: 6, maxHp: 30 });

    expect(screen.getByText('HP 6/30')).toBeTruthy();
    const meter = screen.getByRole('meter', { name: 'Stonefang health' });
    expect(meter.getAttribute('aria-valuenow')).toBe('6');
    expect(meter.getAttribute('aria-valuemin')).toBe('0');
    expect(meter.getAttribute('aria-valuemax')).toBe('30');
  });

  it('bands the hp fill at the same 50%/20% boundaries as the ring roster', () => {
    // 6/30 = 0.2 exactly, which is the hurt/critical boundary in `hpBand` (>= 0.2 is
    // "hurt", strictly below is "critical") — pin the boundary so the two never drift.
    const { container } = renderPanel({ hp: 6, maxHp: 30 });
    const fill = container.querySelector('.roster-bar-fill');
    expect(fill?.className).toContain('roster-bar-hurt');
  });

  it('uses the full non-duplicated revive label for timed and overdue revivals', () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const revivesAt = NOW + 5 * MINUTE;
    const { unmount } = renderPanel({ dead: true, hp: 0, revivesAt });

    expect(screen.getByText('Fallen · revives in 5 min')).toBeTruthy();
    unmount();
    renderPanel({ dead: true, hp: 0, revivesAt: NOW - MINUTE });

    expect(screen.getByText('Fallen · revives any moment')).toBeTruthy();
  });

  it('updates the revive label as time passes and clears its interval on unmount', () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval');
    const revivesAt = NOW + 2 * MINUTE;
    const { container, unmount } = renderPanel({ dead: true, hp: 0, revivesAt });

    expect(screen.getByText('Fallen · revives in 2 min')).toBeTruthy();
    act(() => vi.advanceTimersByTime(2 * MINUTE));
    expect(screen.getByText('Fallen · revives any moment')).toBeTruthy();
    const fill = container.querySelector('.roster-bar-fill') as HTMLElement;
    expect(fill.style.width).toBe('0%');
    expect(fill.className).toContain('roster-bar-critical');
    unmount();
    expect(clearIntervalSpy).toHaveBeenCalled();
  });

  it('shows an empty bar for a dead monster with a revival running', () => {
    const revivesAt = Date.now() + 5 * 60_000;
    const { container } = renderPanel({ dead: true, hp: 0, revivesAt });

    expect(screen.getByText('fallen')).toBeTruthy();
    const fill = container.querySelector('.roster-bar-fill') as HTMLElement;
    expect(fill.style.width).toBe('0%');
    expect(fill.className).toContain('roster-bar-critical');
  });

  it('reads plain "Fallen" with no revive estimate when no revival timer is running', () => {
    renderPanel({ dead: true, hp: 0, revivesAt: null });

    expect(screen.getByText('Fallen')).toBeTruthy();
    expect(screen.queryByText(/revives in/)).toBeNull();
  });

  it('shows the type line as "{type} · Lvl {level}"', () => {
    renderPanel({ type: 'Gladiator', level: 0 });
    expect(screen.getByText('Gladiator · Lvl 0')).toBeTruthy();
  });

  it('labels the xp meter without repeating level, now that level moved to the type line', () => {
    renderPanel({ xpIntoLevel: 14, xpNeededForLevel: 28 });
    expect(screen.getByText('XP 14/28')).toBeTruthy();
  });

  it('shows deck count as text with a "needs N more" hint below a full deck', () => {
    const { container } = renderPanel({
      cardSlots: 9,
      cards: ['Hit', 'Hit', 'Hit', 'Hit', 'Hit', 'Hit', 'Hit'],
    });
    const deckCount = container.querySelector('.workshop-deck-count');
    // The "needs more" clause has its own (muted-styled) span nested inside the deck-count
    // span, so its text is not a direct child text node of either element — assert on the
    // combined textContent rather than `getByText`, which only matches an element's own
    // direct text nodes (see testing-library's `getNodeText`).
    expect(deckCount?.textContent?.replace(/\s+/g, ' ').trim()).toBe(
      'Deck 7/9 · needs 2 more to enter the ring',
    );
  });

  it('drops the "needs more" hint once the deck is full', () => {
    const { container } = renderPanel({
      cardSlots: 9,
      cards: ['Hit', 'Hit', 'Hit', 'Hit', 'Hit', 'Hit', 'Hit', 'Hit', 'Hit'],
    });
    const deckCount = container.querySelector('.workshop-deck-count');
    expect(deckCount?.textContent?.trim()).toBe('Deck 9/9');
    expect(container.querySelector('.workshop-deck-needs-more')).toBeNull();
  });

  it('renders no old-style deck-slot progressbar', () => {
    const { container } = renderPanel();
    expect(container.querySelector('.workshop-slot-meter')).toBeNull();
    expect(screen.queryByRole('progressbar', { name: /slots used/ })).toBeNull();
  });

  it('shows exactly one status tag, preferring "in the ring" over "fighting" over "fallen"', () => {
    const { rerender } = render(
      <MonsterWorkshopPanel
        monster={{ ...baseMonster, inRing: true, inEncounter: true, dead: true }}
        showSelectionHint={false}
        selectedCards={[]}
        onDropCard={noop}
        onTapSlot={noop}
        onSelectCard={noop}
        onUnequipAll={noop}
        onRevive={noop}
        onSendToRing={noop}
        onSavePreset={noop}
        onLoadPreset={noop}
        onDeletePreset={noop}
      />,
    );
    expect(screen.getByText('in the ring')).toBeTruthy();
    expect(screen.queryByText('fighting')).toBeNull();
    expect(screen.queryByText('fallen')).toBeNull();

    rerender(
      <MonsterWorkshopPanel
        monster={{ ...baseMonster, inRing: false, inEncounter: true, dead: true }}
        showSelectionHint={false}
        selectedCards={[]}
        onDropCard={noop}
        onTapSlot={noop}
        onSelectCard={noop}
        onUnequipAll={noop}
        onRevive={noop}
        onSendToRing={noop}
        onSavePreset={noop}
        onLoadPreset={noop}
        onDeletePreset={noop}
      />,
    );
    expect(screen.getByText('fighting')).toBeTruthy();
    expect(screen.queryByText('fallen')).toBeNull();
  });

  it('shows no status tag for a healthy, benched monster', () => {
    renderPanel({ inRing: false, inEncounter: false, dead: false });
    expect(screen.queryByText('in the ring')).toBeNull();
    expect(screen.queryByText('fighting')).toBeNull();
    expect(screen.queryByText('fallen')).toBeNull();
  });
});

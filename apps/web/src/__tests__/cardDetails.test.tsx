import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const makeMonster = (over: Record<string, unknown>) => ({
  name: 'Rex',
  type: 'Gladiator',
  monsterClass: 'Fighter',
  level: 1,
  xpIntoLevel: 0,
  xpNeededForLevel: 10,
  dead: false,
  inRing: false,
  inEncounter: false,
  cardSlots: 3,
  cards: [] as string[],
  presets: {},
  hp: 10,
  maxHp: 10,
  revivesAt: null,
  battles: { wins: 0, losses: 0, total: 0 },
  nextCards: null,
  ...over,
});

const FACTS = [
  { name: 'Hit', icon: '', role: 'attack', roleLabel: 'Attacks', description: 'A plain hit.', stats: 'Hit 1d20 vs AC, damage 1d6.', level: 0, usedBy: [], price: 0 },
  { name: 'Blink', icon: '', role: 'trick', roleLabel: 'Tricks and curses', description: 'Wink out of sight.', stats: '', level: 0, usedBy: ['Jinn', 'Minotaur'], price: 1 },
  { name: 'Fire Breath', icon: '', role: 'area', roleLabel: 'Area attacks', description: 'Burn them all.', stats: '', level: 3, usedBy: ['Gladiator'], price: 40 },
];

const hookMock = vi.hoisted(() => ({
  monsters: [] as Array<Record<string, unknown>>,
  cardFacts: [] as Array<Record<string, unknown>>,
  unequippedDeck: [] as string[],
  cardCompatibility: {} as Record<string, string[]>,
  items: { character: [], monsters: [] },
  spawnOptions: { types: [], pronouns: [] },
  loading: false,
  busy: false,
  latestError: null as string | null,
  equipCards: vi.fn(), unequipCard: vi.fn(), unequipMany: vi.fn(), unequipAll: vi.fn(),
  moveCard: vi.fn(), moveMany: vi.fn(), reorderCards: vi.fn(), savePreset: vi.fn(),
  loadPreset: vi.fn(), deletePreset: vi.fn(), reviveMonster: vi.fn(), spawnMonster: vi.fn(),
  sendMonsterToRing: vi.fn(), refresh: vi.fn(), roomName: 'Test Room', shop: undefined,
}));

vi.mock('../hooks/useDeckWorkshop.js', () => ({ useDeckWorkshop: () => hookMock }));
vi.mock('../hooks/useGuidedStart.js', () => ({
  useGuidedStart: () => ({ phase: 'hidden', name: '', slots: 0, dismiss: () => undefined }),
}));

import WorkshopPanel from '../components/WorkshopPanel.js';
import MonsterWorkshopPanel from '../components/MonsterWorkshopPanel.js';

function setup() {
  hookMock.cardFacts = FACTS;
  hookMock.monsters = [
    makeMonster({ name: 'Rex', cards: ['Hit', 'Blink'], nextCards: { level: 3, cards: ['Fire Breath', 'Gore'] } }),
    makeMonster({ name: 'Mira', type: 'Jinn', monsterClass: 'Mage', level: 0, cards: [] }),
  ];
  hookMock.unequippedDeck = ['Fire Breath', 'Hit'];
  hookMock.cardCompatibility = { 'Fire Breath': ['Rex'], Hit: ['Rex', 'Mira'] };
}

describe('card details sheet in the Workshop', () => {
  it('opens from a monster slot with the plan lines and a verdict for that monster only', () => {
    setup();
    render(<WorkshopPanel roomId="room-1" />);

    const rex = document.querySelectorAll('.workshop-monster-panel')[0] as HTMLElement;
    fireEvent.click(within(rex).getByRole('button', { name: 'What Blink does' }));

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('heading', { name: 'Blink' })).toBeTruthy();
    expect(within(dialog).getByText('Tricks and curses')).toBeTruthy();
    expect(within(dialog).getByText('Wink out of sight.')).toBeTruthy();
    expect(within(dialog).getByText('Level: Beginner')).toBeTruthy();
    expect(within(dialog).getByText('Used by: Jinn and Minotaur')).toBeTruthy();
    expect(within(dialog).getByText('Price: 1 coin')).toBeTruthy();
    // Rex is a Gladiator, so Blink is not for him; Mira is not mentioned.
    expect(within(dialog).getByText("Rex can't use this. Only Jinn and Minotaur can.")).toBeTruthy();
    expect(within(dialog).queryByText(/Mira/)).toBeNull();
    // The info button carries the plan's title.
    expect(screen.getAllByTitle('What this card does').length).toBeGreaterThan(0);
  });

  it('shows "Price: free" and the stats line, and says the monster can use a card it can', () => {
    setup();
    render(<WorkshopPanel roomId="room-1" />);
    fireEvent.click(screen.getAllByRole('button', { name: 'What Hit does' })[0]!);
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Price: free')).toBeTruthy();
    expect(within(dialog).getByText('Hit 1d20 vs AC, damage 1d6.')).toBeTruthy();
    expect(within(dialog).getByText('Used by: Any monster')).toBeTruthy();
    expect(within(dialog).getByText('Rex can use this.')).toBeTruthy();
  });

  it('gives a card in Your cards one verdict per monster, or just the highlighted one', () => {
    setup();
    render(<WorkshopPanel roomId="room-1" />);
    const inventory = document.querySelector('.workshop-inventory') as HTMLElement;

    fireEvent.click(within(inventory).getByRole('button', { name: 'What Fire Breath does' }));
    let dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Rex can use this from level 3. Rex is level 1 now.')).toBeTruthy();
    expect(within(dialog).getByText("Mira can't use this. Only Gladiator can.")).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();

    // Highlight Mira (the filter button) and only her line shows.
    fireEvent.click(screen.getByTitle('Filter inventory cards for Mira'));
    fireEvent.click(within(inventory).getAllByRole('button', { name: 'What Fire Breath does' })[0]!);
    dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText("Mira can't use this. Only Gladiator can.")).toBeTruthy();
    expect(within(dialog).queryByText(/Rex/)).toBeNull();
  });

  it('closes on Escape and from the Close button (titled), and focus moves in then back', () => {
    setup();
    render(<WorkshopPanel roomId="room-1" />);
    const opener = screen.getAllByRole('button', { name: 'What Hit does' })[0]!;
    opener.focus();
    fireEvent.click(opener);

    const close = screen.getByRole('button', { name: 'Close' });
    expect(close.getAttribute('title')).toBe('Close the card details');
    expect(document.activeElement).toBe(close);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it('keeps a tap on the card itself selecting it, not opening the sheet', () => {
    setup();
    render(<WorkshopPanel roomId="room-1" />);
    const inventory = document.querySelector('.workshop-inventory') as HTMLElement;
    fireEvent.click(within(inventory).getByRole('button', { name: 'Fire Breath' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(inventory.querySelectorAll('.workshop-card-slot.selected')).toHaveLength(1);
  });

  it('labels slots from the role, not from guessing at the name', () => {
    setup();
    render(<WorkshopPanel roomId="room-1" />);
    const labels = Array.from(document.querySelectorAll('.workshop-card-class')).map((el) => el.textContent);
    // Hit (attack), Blink (trick), Fire Breath (area): the engine's role table.
    expect(labels).toEqual(expect.arrayContaining(['ATTACK', 'TRICK', 'AREA']));
    expect(labels).not.toContain('MAGIC');
    expect(labels).not.toContain('UTILITY');
  });

  it('matches a card whose display name carries its dice to the stable facts', () => {
    setup();
    hookMock.cardFacts = [
      ...FACTS,
      { name: 'The Kalevala', icon: '', role: 'attack', roleLabel: 'Attacks', description: 'Sing.', stats: '', level: 0, usedBy: [], price: 3 },
    ];
    hookMock.unequippedDeck = ['The Kalevala (1d4)'];
    render(<WorkshopPanel roomId="room-1" />);
    expect(Array.from(document.querySelectorAll('.workshop-card-class')).map((el) => el.textContent)).toContain('ATTACK');
    fireEvent.click(screen.getByRole('button', { name: 'What The Kalevala (1d4) does' }));
    expect(within(screen.getByRole('dialog')).getByRole('heading', { name: 'The Kalevala' })).toBeTruthy();
  });
});

describe('"At level N" line on a monster panel', () => {
  const noop = () => undefined;
  const renderPanel = (monster: ReturnType<typeof makeMonster>) =>
    render(
      <MonsterWorkshopPanel
        monster={monster}
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

  it('names the next level that opens cards', () => {
    renderPanel(makeMonster({ nextCards: { level: 3, cards: ['Fire Breath', 'Gore', 'Hit'] } }));
    expect(screen.getByText('At level 3: Fire Breath, Gore and Hit.')).toBeTruthy();
  });

  it('shows no line when nothing opens later', () => {
    renderPanel(makeMonster({ nextCards: null }));
    expect(screen.queryByText(/^At level/)).toBeNull();
  });
});

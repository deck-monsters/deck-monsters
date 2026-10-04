import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  monsters: [] as Array<Record<string, unknown>> | undefined,
  history: [] as Array<{ type: string }> | undefined,
  historyError: false,
  ring: { inEncounter: false, contestants: [] as unknown[] },
}));

vi.mock('../lib/auth-context.js', () => ({ useAuth: () => ({ user: { id: 'user-1' } }) }));
vi.mock('../lib/trpc.js', () => ({
  trpc: {
    game: {
      myInventory: { useQuery: () => ({ data: mocks.monsters ? { monsters: mocks.monsters } : undefined }) },
      ringState: { useQuery: () => ({ data: mocks.ring }) },
      consoleHistory: { useQuery: () => ({ data: mocks.historyError ? undefined : mocks.history, isError: mocks.historyError }) },
    },
  },
}));

import GuidedStartBox from '../components/GuidedStartBox.js';
import {
  deckChanged,
  deckSnapshot,
  guidedStep,
  isEstablishedPlayer,
  resetGuidedStartForTests,
  useGuidedStart,
  type GuidedMonster,
} from '../hooks/useGuidedStart.js';

const mon = (over: Partial<GuidedMonster> = {}): GuidedMonster => ({
  name: 'Saffron',
  dead: false,
  inRing: false,
  cards: [],
  cardSlots: 3,
  battles: { total: 0 },
  ...over,
});
const full = ['A', 'B', 'C'];

describe('guidedStep', () => {
  it('walks the phases in order', () => {
    expect(guidedStep([], false).phase).toBe('spawn');
    expect(guidedStep([mon({ cards: ['A'] })], false)).toEqual({ phase: 'equip', name: 'Saffron', slots: 3 });
    expect(guidedStep([mon({ cards: full })], false).phase).toBe('send');
    expect(guidedStep([mon({ cards: full, inRing: true })], false).phase).toBe('waiting');
    expect(guidedStep([mon({ cards: full, battles: { total: 1 }, dead: true })], false).phase).toBe('fallen');
    expect(guidedStep([mon({ cards: full, battles: { total: 1 } })], false).phase).toBe('change_card');
  });

  it('does not suggest sending a monster whose deck is not full', () => {
    expect(guidedStep([mon({ cards: ['A', 'B'] })], false).phase).toBe('equip');
  });

  it('is hidden once complete, whatever the monsters', () => {
    expect(guidedStep([], true).phase).toBe('hidden');
    expect(guidedStep([mon()], true).phase).toBe('hidden');
  });

  it('shows waiting, not equip, when a monster is in the ring and another has a short deck', () => {
    const step = guidedStep([mon({ name: 'Ring', cards: full, inRing: true }), mon({ name: 'Bare' })], false);
    expect(step).toMatchObject({ phase: 'waiting', name: 'Ring' });
  });

  it('only a monster still in the inventory can drive fallen; a buried one neither drives it nor blocks change_card', () => {
    // A permanently destroyed monster is dropped from the character, so it is simply absent.
    const survivor = mon({ name: 'Ok', cards: full });
    expect(guidedStep([survivor], false, true)).toMatchObject({ phase: 'change_card', name: 'Ok' });
    expect(guidedStep([mon({ name: 'Gone', dead: true, battles: { total: 1 } })], false)).toMatchObject({ phase: 'fallen', name: 'Gone' });
  });

  it('puts fallen ahead of change_card', () => {
    const step = guidedStep([mon({ name: 'Ok', cards: full, battles: { total: 2 } }), mon({ name: 'Gone', dead: true, battles: { total: 2 } })], false);
    expect(step).toMatchObject({ phase: 'fallen', name: 'Gone' });
  });
});

describe('isEstablishedPlayer / deckSignature', () => {
  it('counts fights, outcome history and a second monster', () => {
    expect(isEstablishedPlayer([mon()], false)).toBe(false);
    expect(isEstablishedPlayer([mon({ battles: { total: 1 } })], false)).toBe(true);
    expect(isEstablishedPlayer([mon()], true)).toBe(true);
    expect(isEstablishedPlayer([mon(), mon({ name: 'B' })], false)).toBe(true);
  });

  it('sees a card move or go, not a reorder, a new monster or a missing one', () => {
    const base = deckSnapshot([mon({ cards: ['A', 'B'] }), mon({ name: 'Other', cards: ['C'] })]);
    expect(deckChanged(base, [mon({ cards: ['B', 'A'] }), mon({ name: 'Other', cards: ['C'] })])).toBe(false);
    expect(deckChanged(base, [mon({ cards: ['A', 'B'] }), mon({ name: 'Other', cards: ['C'] }), mon({ name: 'New' })])).toBe(false);
    expect(deckChanged(base, [mon({ cards: ['A', 'B'] })])).toBe(false);
    expect(deckChanged(base, [mon({ cards: ['A'] }), mon({ name: 'Other', cards: ['C'] })])).toBe(true);
  });
});

describe('useGuidedStart', () => {
  beforeEach(() => {
    localStorage.clear();
    resetGuidedStartForTests();
    mocks.history = [];
    mocks.monsters = [];
    mocks.historyError = false;
    mocks.ring = { inEncounter: false, contestants: [] };
  });

  const run = (room = 'room-1') => renderHook(() => useGuidedStart(room));

  it('is hidden for an established player on first load, and stays hidden', () => {
    mocks.monsters = [{ name: 'Old', cards: full, cardSlots: 3, battles: { total: 4 } }];
    const { result, rerender } = run();
    expect(result.current.phase).toBe('hidden');
    expect(localStorage.getItem('ftuxComplete:user-1:room-1')).toBe('true');
    mocks.monsters = [{ name: 'Old', cards: full, cardSlots: 3, dead: true, battles: { total: 4 } }];
    rerender();
    expect(result.current.phase).toBe('hidden');
  });

  it('moves a new player from the first fight to fallen, then change_card, instead of ending', () => {
    mocks.monsters = [{ name: 'Saffron', cards: full, cardSlots: 3, inRing: true, battles: { total: 0 } }];
    const { result, rerender } = run();
    expect(result.current.phase).toBe('waiting');
    mocks.monsters = [{ name: 'Saffron', cards: full, cardSlots: 3, dead: true, battles: { total: 1 } }];
    rerender();
    expect(result.current.phase).toBe('fallen');
    mocks.monsters = [{ name: 'Saffron', cards: full, cardSlots: 3, battles: { total: 1 } }];
    rerender();
    expect(result.current.phase).toBe('change_card');
  });

  it('survives a reload after the first fight (the started flag stands in for the first load)', () => {
    mocks.monsters = [{ name: 'Saffron', cards: full, cardSlots: 3, inRing: true, battles: { total: 0 } }];
    run().unmount();
    resetGuidedStartForTests();
    mocks.monsters = [{ name: 'Saffron', cards: full, cardSlots: 3, battles: { total: 1 } }];
    expect(run().result.current.phase).toBe('change_card');
  });

  it('ends change_card when a card is changed on any monster', () => {
    mocks.monsters = [{ name: 'Saffron', cards: [...full], cardSlots: 3, battles: { total: 0 } }];
    const { result, rerender } = run();
    mocks.monsters = [{ name: 'Saffron', cards: [...full], cardSlots: 3, battles: { total: 1 } }];
    rerender();
    expect(result.current.phase).toBe('change_card');
    mocks.monsters = [{ name: 'Saffron', cards: ['A', 'B'], cardSlots: 3, battles: { total: 1 } }];
    rerender();
    expect(result.current.phase).toBe('hidden');
    expect(localStorage.getItem('ftuxComplete:user-1:room-1')).toBe('true');
  });

  it('keeps change_card when a second monster is trained, and ends it when a card moves', () => {
    mocks.monsters = [{ name: 'Saffron', cards: [...full], cardSlots: 3, battles: { total: 0 } }];
    const { result, rerender } = run();
    mocks.monsters = [{ name: 'Saffron', cards: [...full], cardSlots: 3, battles: { total: 1 } }];
    rerender();
    expect(result.current.phase).toBe('change_card');
    mocks.monsters = [
      { name: 'Saffron', cards: [...full], cardSlots: 3, battles: { total: 1 } },
      { name: 'Newbie', cards: [], cardSlots: 3, battles: { total: 0 } },
    ];
    rerender();
    expect(result.current.phase).toBe('change_card');
    mocks.monsters = [
      { name: 'Saffron', cards: ['A', 'B', 'D'], cardSlots: 3, battles: { total: 1 } },
      { name: 'Newbie', cards: [], cardSlots: 3, battles: { total: 0 } },
    ];
    rerender();
    expect(result.current.phase).toBe('hidden');
  });

  it('decides and dismisses per room', () => {
    mocks.monsters = [{ name: 'Saffron', cards: [], cardSlots: 3 }];
    const a = run('room-a');
    act(() => a.result.current.dismiss());
    expect(a.result.current.phase).toBe('hidden');
    expect(run('room-b').result.current.phase).toBe('equip');
    // A veteran in room-c does not hide the new player's guide in room-d.
    mocks.monsters = [{ name: 'Old', cards: full, cardSlots: 3, battles: { total: 4 } }];
    expect(run('room-c').result.current.phase).toBe('hidden');
    mocks.monsters = [{ name: 'Saffron', cards: [], cardSlots: 3 }];
    expect(run('room-d').result.current.phase).toBe('equip');
  });

  it.each(['ftuxComplete:user-1', 'ftuxComplete'])('still honours the older %s flag in every room', (key) => {
    localStorage.setItem(key, 'true');
    mocks.monsters = [{ name: 'Saffron', cards: [], cardSlots: 3 }];
    expect(run('room-z').result.current.phase).toBe('hidden');
  });

  it('stays hidden when the console history query fails', () => {
    mocks.historyError = true;
    mocks.monsters = [{ name: 'Saffron', cards: [], cardSlots: 3 }];
    expect(run().result.current.phase).toBe('hidden');
  });

  it('hides every surface when one dismisses', () => {
    mocks.monsters = [{ name: 'Saffron', cards: [], cardSlots: 3 }];
    const a = run();
    const b = run();
    expect(a.result.current.phase).toBe('equip');
    expect(b.result.current.phase).toBe('equip');
    act(() => a.result.current.dismiss());
    expect(a.result.current.phase).toBe('hidden');
    expect(b.result.current.phase).toBe('hidden');
  });
});

describe('useGuidedStart fightComing', () => {
  beforeEach(() => {
    localStorage.clear();
    resetGuidedStartForTests();
    mocks.history = [];
    mocks.historyError = false;
    mocks.monsters = [{ name: 'Saffron', cards: full, cardSlots: 3, inRing: true, battles: { total: 0 } }];
  });

  it('is false while the player is alone in the ring', () => {
    mocks.ring = { inEncounter: false, contestants: [{ name: 'Saffron' }] };
    const { result } = renderHook(() => useGuidedStart('room-1'));
    expect(result.current.phase).toBe('waiting');
    expect(result.current.fightComing).toBe(false);
  });

  it('is true once a second monster or a boss shares the ring, and a live fight is fightOn instead', () => {
    mocks.ring = { inEncounter: false, contestants: [{ name: 'Saffron' }, { name: 'Razeth', isBoss: true }] };
    expect(renderHook(() => useGuidedStart('room-1')).result.current.fightComing).toBe(true);
    mocks.ring = { inEncounter: true, contestants: [] };
    const live = renderHook(() => useGuidedStart('room-1')).result.current;
    expect(live.fightOn).toBe(true);
    expect(live.fightComing).toBe(false);
  });
});

describe('GuidedStartBox', () => {
  it('shows the Workshop equip copy with the name and slots, and no chip', () => {
    render(<GuidedStartBox surface="workshop" phase="equip" name="Saffron" slots={5} dismiss={() => undefined} />);
    expect(screen.getByText('Give Saffron a full deck: tap a card in Your cards, then tap one of Saffron\'s empty slots. Fill all 5.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /equip/ })).toBeNull();
  });

  it('renders nothing in the Workshop during spawn', () => {
    const { container } = render(<GuidedStartBox surface="workshop" phase="spawn" name="" slots={0} dismiss={() => undefined} />);
    expect(container).toBeEmptyDOMElement();
  });

  it.each([
    ['spawn', '', 'train a monster'],
    ['equip', 'Saffron', 'equip Saffron'],
    ['send', 'Saffron', 'send Saffron to the ring'],
    ['waiting', 'Saffron', 'summon a boss'],
    ['fallen', 'Saffron', 'revive Saffron'],
    ['change_card', 'Saffron', 'help unequip'],
  ] as const)('the Console %s chip runs its command', (phase, name, command) => {
    const run = vi.fn();
    render(<GuidedStartBox surface="console" phase={phase} name={name} slots={3} dismiss={() => undefined} onRun={run} />);
    fireEvent.click(screen.getByRole('button', { name: command }));
    expect(run).toHaveBeenCalledWith(command);
  });

  it('tells the Console player to watch once a fight is coming, with no summon chip', () => {
    render(<GuidedStartBox surface="console" phase="waiting" name="Saffron" slots={3} fightComing dismiss={() => undefined} onRun={() => undefined} />);
    expect(screen.getByText('Saffron is in the ring. Watch The Ring: a fight starts when the countdown ends.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'summon a boss' })).toBeNull();
    expect(screen.queryByText(/summon/i)).toBeNull();
  });

  it('says the fight is on, not that a countdown is running, during a live fight', () => {
    render(<GuidedStartBox surface="console" phase="waiting" name="Saffron" slots={3} fightOn fightComing dismiss={() => undefined} onRun={() => undefined} />);
    expect(screen.getByText('Saffron is fighting. Watch The Ring.')).toBeInTheDocument();
    expect(screen.queryByText(/countdown/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'summon a boss' })).toBeNull();
  });

  it('says the same in the Workshop, and keeps the summon advice while alone', () => {
    const { unmount } = render(<GuidedStartBox surface="workshop" phase="waiting" name="Saffron" slots={3} fightComing dismiss={() => undefined} />);
    expect(screen.getByText(/Watch The Ring: a fight starts when the countdown ends\./)).toBeInTheDocument();
    unmount();
    render(<GuidedStartBox surface="console" phase="waiting" name="Saffron" slots={3} dismiss={() => undefined} onRun={() => undefined} />);
    expect(screen.getByText(/Nobody else here\? Summon a boss\./)).toBeInTheDocument();
  });

  it('dismisses from the ✕', () => {
    const dismiss = vi.fn();
    render(<GuidedStartBox surface="console" phase="send" name="Saffron" slots={3} dismiss={dismiss} onRun={() => undefined} />);
    fireEvent.click(screen.getByTitle('Dismiss guide'));
    expect(dismiss).toHaveBeenCalled();
  });
});

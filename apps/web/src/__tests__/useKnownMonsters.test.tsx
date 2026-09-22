import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { rememberMonsters, resetKnownMonsters, useKnownMonsters } from '../hooks/useKnownMonsters.js';
import type { RingContestantSnapshot } from '../components/RingRoster.js';

function c(name: string, over: Partial<RingContestantSnapshot> = {}): RingContestantSnapshot {
  return {
    name, icon: '🐍', creatureType: 'Basilisk', level: 1, hp: 10, maxHp: 10, ac: 5,
    dead: false, isBoss: false, team: null, owner: 'Ada', userId: 'u1', ...over,
  };
}

describe('known monsters store', () => {
  beforeEach(() => resetKnownMonsters());

  it('remembers monsters after the ring clears, so a finished fight keeps its sprites', () => {
    const { result } = renderHook(() => useKnownMonsters('room-1'));
    act(() => rememberMonsters('room-1', [c('Gin'), c('Hissy')]));
    act(() => rememberMonsters('room-1', []));

    expect(result.current.monsters.map((monster) => monster.name)).toEqual(['Gin', 'Hissy']);
  });

  it('keeps rooms apart — one room\'s monsters never decorate another room\'s text', () => {
    act(() => rememberMonsters('room-1', [c('Gin')]));
    act(() => rememberMonsters('room-2', [c('Ben', { icon: '💪', creatureType: 'Gladiator' })]));
    const room1 = renderHook(() => useKnownMonsters('room-1'));
    const room2 = renderHook(() => useKnownMonsters('room-2'));

    expect(room1.result.current.monsters.map((monster) => monster.name)).toEqual(['Gin']);
    expect(room2.result.current.monsters.map((monster) => monster.name)).toEqual(['Ben']);
  });

  it('reaches a reader in another pane, which is the point of the store', () => {
    // The Console and the fight history have no roster; they read what the Ring recorded.
    const consoleReader = renderHook(() => useKnownMonsters('room-1'));
    act(() => rememberMonsters('room-1', [c('Gin')]));

    expect(consoleReader.result.current.monsters.map((monster) => monster.name)).toEqual(['Gin']);
  });

  it('keeps its identity while nothing changes, so the matcher is not rebuilt per tick', () => {
    const { result } = renderHook(() => useKnownMonsters('room-1'));
    act(() => rememberMonsters('room-1', [c('Gin', { hp: 10 })]));
    const first = result.current;
    // Only HP changed — every ring.state tick looks like this.
    act(() => rememberMonsters('room-1', [c('Gin', { hp: 4 })]));

    expect(result.current).toBe(first);
  });

  it('takes a changed appearance or icon', () => {
    const { result } = renderHook(() => useKnownMonsters('room-1'));
    act(() => rememberMonsters('room-1', [c('Gin', { appearance: 'green' })]));
    act(() => rememberMonsters('room-1', [c('Gin', { appearance: 'crimson', icon: '🔥' })]));

    expect(result.current.monsters).toEqual([
      { name: 'Gin', icon: '🔥', creatureType: 'Basilisk', appearance: 'crimson', appearanceHex: null },
    ]);
  });

  it('records Beastmaster names so the matcher can refuse a shared one', () => {
    const { result } = renderHook(() => useKnownMonsters('room-1'));
    act(() => rememberMonsters('room-1', [c('Gin', { owner: 'Ada' })]));

    expect(result.current.beastmasterNames).toEqual(['Ada']);
  });

  it('learns from fight-history rows, and skips rows written before the sprite fields', () => {
    // A history opened after a reload has no roster; its participant rows are all it has.
    const { result } = renderHook(() => useKnownMonsters('room-1'));
    act(() => rememberMonsters('room-1', [
      { name: 'Gin', icon: '🐍', creatureType: 'Basilisk', appearance: 'green', owner: 'Ada' },
      { name: 'Old Timer', icon: '', creatureType: '', owner: 'Bo' },
    ]));

    expect(result.current.monsters.map((monster) => monster.name)).toEqual(['Gin']);
  });
});

import { describe, expect, it } from 'vitest';
import type { WorkshopCardLocation } from '../components/CardSlot.js';

type SelectionState = {
  location: WorkshopCardLocation;
  cardName: string;
  selectionId: string;
};

function isSameSource(a: WorkshopCardLocation, b: WorkshopCardLocation): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'inventory') return true;
  return b.kind === 'monster' && a.monsterName === b.monsterName;
}

function toggleSelection(
  previous: SelectionState[],
  next: { location: WorkshopCardLocation; cardName: string; selectionId: string },
): SelectionState[] {
  const existing = previous.find((entry) => entry.selectionId === next.selectionId);
  if (existing) {
    return previous.filter((entry) => entry.selectionId !== next.selectionId);
  }

  if (previous.length < 1) {
    return [next];
  }

  const first = previous[0];
  const sameKind = first.location.kind === next.location.kind;
  const sameMonsterSource =
    first.location.kind !== 'monster' ||
    (next.location.kind === 'monster' && first.location.monsterName === next.location.monsterName);

  if (!sameKind || !sameMonsterSource) {
    return [next];
  }

  return [...previous, next];
}

describe('workshop selection state', () => {
  it('clears previous selection when selecting from a different source', () => {
    const previous: SelectionState[] = [
      {
        location: { kind: 'inventory' },
        cardName: 'Hit',
        selectionId: 'inventory:0',
      },
      {
        location: { kind: 'inventory' },
        cardName: 'Heal',
        selectionId: 'inventory:1',
      },
    ];

    const next = toggleSelection(previous, {
      location: { kind: 'monster', monsterName: 'Stonefang' },
      cardName: 'Blink',
      selectionId: 'Stonefang:0',
    });

    expect(next).toEqual([
      {
        location: { kind: 'monster', monsterName: 'Stonefang' },
        cardName: 'Blink',
        selectionId: 'Stonefang:0',
      },
    ]);
  });

  it('toggles an existing selected card off', () => {
    const previous: SelectionState[] = [
      {
        location: { kind: 'monster', monsterName: 'Stonefang' },
        cardName: 'Hit',
        selectionId: 'Stonefang:0',
      },
      {
        location: { kind: 'monster', monsterName: 'Stonefang' },
        cardName: 'Heal',
        selectionId: 'Stonefang:1',
      },
    ];

    const next = toggleSelection(previous, {
      location: { kind: 'monster', monsterName: 'Stonefang' },
      cardName: 'Heal',
      selectionId: 'Stonefang:1',
    });

    expect(next).toEqual([
      {
        location: { kind: 'monster', monsterName: 'Stonefang' },
        cardName: 'Hit',
        selectionId: 'Stonefang:0',
      },
    ]);
  });

  it('treats cross-source targets as move destinations', () => {
    expect(
      isSameSource(
        { kind: 'inventory' },
        { kind: 'monster', monsterName: 'Stonefang' },
      ),
    ).toBe(false);
    expect(
      isSameSource(
        { kind: 'monster', monsterName: 'Stonefang' },
        { kind: 'inventory' },
      ),
    ).toBe(false);
  });

  it('treats same-source targets as selection clear targets', () => {
    expect(
      isSameSource(
        { kind: 'inventory' },
        { kind: 'inventory' },
      ),
    ).toBe(true);
    expect(
      isSameSource(
        { kind: 'monster', monsterName: 'Stonefang' },
        { kind: 'monster', monsterName: 'Stonefang' },
      ),
    ).toBe(true);
  });
});

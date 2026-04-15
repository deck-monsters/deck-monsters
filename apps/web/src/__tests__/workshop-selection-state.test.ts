import { describe, expect, it } from 'vitest';
import type { WorkshopCardLocation } from '../components/CardSlot.js';
import {
  groupSelectionByCardName,
  isSameSource,
  toggleWorkshopSelection,
  type WorkshopSelectionState,
} from '../utils/workshop-selection.js';

type SelectionState = {
  location: WorkshopCardLocation;
  cardName: string;
  selectionId: string;
};

function asWorkshopSelection(selection: SelectionState[]): WorkshopSelectionState[] {
  return selection;
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

    const next = toggleWorkshopSelection(asWorkshopSelection(previous), {
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

    const next = toggleWorkshopSelection(asWorkshopSelection(previous), {
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

  it('groups selection entries by card name', () => {
    const grouped = groupSelectionByCardName([
      { location: { kind: 'inventory' }, cardName: 'Hit', selectionId: 'inventory:0' },
      { location: { kind: 'inventory' }, cardName: 'Hit', selectionId: 'inventory:1' },
      { location: { kind: 'inventory' }, cardName: 'Heal', selectionId: 'inventory:2' },
    ]);

    expect(grouped).toEqual([
      { cardName: 'Hit', count: 2 },
      { cardName: 'Heal', count: 1 },
    ]);
  });
});

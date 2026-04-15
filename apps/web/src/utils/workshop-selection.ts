import type { WorkshopCardLocation } from '../components/CardSlot.js';

export type WorkshopSelectionState = {
  location: WorkshopCardLocation;
  cardName: string;
  selectionId: string;
};

export function groupSelectionByCardName(
  selection: WorkshopSelectionState[],
): Array<{ cardName: string; count: number }> {
  const grouped = selection.reduce<Record<string, number>>((all, entry) => {
    all[entry.cardName] = (all[entry.cardName] ?? 0) + 1;
    return all;
  }, {});
  return Object.entries(grouped).map(([cardName, count]) => ({ cardName, count }));
}

export function isSameSource(a: WorkshopCardLocation, b: WorkshopCardLocation): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'inventory') return true;
  return b.kind === 'monster' && a.monsterName === b.monsterName;
}

export function toggleWorkshopSelection(
  previous: WorkshopSelectionState[],
  next: WorkshopSelectionState,
): WorkshopSelectionState[] {
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

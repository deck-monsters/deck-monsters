import { describe, expect, it } from 'vitest';

import {
  BIG_HIT_FLOOR,
  classifyHighlight,
  isBigHit,
} from '../utils/fight-highlights.js';

function ev(overrides: Record<string, unknown>) {
  return {
    id: 'e1',
    roomId: 'r',
    timestamp: Date.now(),
    type: 'announce',
    scope: 'public',
    text: '',
    payload: {},
    ...overrides,
  } as never;
}

describe('classifyHighlight (#110)', () => {
  it('catches a natural 20 from the engine flag', () => {
    expect(classifyHighlight(ev({ payload: { roll: { strokeOfLuck: true } } }))?.kind).toBe('nat20');
  });

  it('catches a natural 20 with no flag set', () => {
    // A card can roll a 20 without Stroke of Luck being involved.
    expect(
      classifyHighlight(ev({ payload: { roll: { naturalRoll: { result: 20 } } } }))?.kind
    ).toBe('nat20');
  });

  it('catches a critical failure both ways', () => {
    expect(classifyHighlight(ev({ payload: { roll: { curseOfLoki: true } } }))?.kind).toBe('critFail');
    expect(
      classifyHighlight(ev({ payload: { roll: { naturalRoll: { result: 1 } } } }))?.kind
    ).toBe('critFail');
  });

  it('ignores an ordinary roll', () => {
    expect(classifyHighlight(ev({ payload: { roll: { naturalRoll: { result: 11 } } } }))).toBe(null);
  });

  it('catches a kill from the death announcement', () => {
    expect(
      classifyHighlight(ev({ payload: { destroyed: false, assailant: {}, monster: {} } }))?.kind
    ).toBe('kill');
  });

  it('catches permadeath and fleeing by event type', () => {
    expect(classifyHighlight(ev({ type: 'ring.permaDeath' }))?.kind).toBe('kill');
    expect(classifyHighlight(ev({ type: 'ring.fled' }))?.kind).toBe('flee');
  });

  it('ignores an ordinary announcement', () => {
    expect(classifyHighlight(ev({ text: 'A boss will enter the ring in 2 minutes.' }))).toBe(null);
  });

  it('labels every highlight it returns', () => {
    const h = classifyHighlight(ev({ type: 'ring.fled' }));
    expect(h?.label).toBe('FLED');
  });
});

describe('isBigHit', () => {
  // Significance is a ratio: the same number is a scratch on a boss and near-lethal
  // on a beginner.
  it('scales with the target rather than using a flat number', () => {
    expect(isBigHit(9, 53)).toBe(false); // boss: under a quarter
    expect(isBigHit(9, 33)).toBe(true); // beginner: over a quarter
  });

  it('ignores chip damage even on a tiny target', () => {
    expect(isBigHit(2, 4)).toBe(false);
    expect(isBigHit(BIG_HIT_FLOOR - 1, 8)).toBe(false);
  });

  it('falls back to the floor when maxHp is unknown', () => {
    expect(isBigHit(BIG_HIT_FLOOR, null)).toBe(true);
    expect(isBigHit(1, null)).toBe(false);
  });

  it('ignores zero and negative damage', () => {
    expect(isBigHit(0, 33)).toBe(false);
    expect(isBigHit(-5, 33)).toBe(false);
  });

  it('is reachable through classifyHighlight', () => {
    expect(classifyHighlight(ev({ payload: { damage: 20, maxHp: 33 } }))?.kind).toBe('bigHit');
  });
});

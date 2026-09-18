import { describe, expect, it } from 'vitest';

import {
  BIG_HIT_FLOOR,
  classifyHighlight,
  createDamageHistory,
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
      classifyHighlight(ev({ payload: { roll: { primaryDice: '1d20', naturalRoll: { result: 20 } } } }))?.kind
    ).toBe('nat20');
  });

  it('catches a critical failure both ways', () => {
    expect(classifyHighlight(ev({ payload: { roll: { curseOfLoki: true } } }))?.kind).toBe('critFail');
    expect(
      classifyHighlight(ev({ payload: { roll: { primaryDice: '1d20', naturalRoll: { result: 1 } } } }))?.kind
    ).toBe('critFail');
  });

  it('does not call the minimum result on a damage die a critical failure', () => {
    expect(
      classifyHighlight(ev({ payload: { roll: { primaryDice: '1d6', naturalRoll: { result: 1 } } } }))
    ).toBe(null);
  });

  it('does not infer a critical result when the die is unknown', () => {
    expect(classifyHighlight(ev({ payload: { roll: { naturalRoll: { result: 1 } } } }))).toBe(null);
    expect(classifyHighlight(ev({ payload: { roll: { naturalRoll: { result: 20 } } } }))).toBe(null);
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

describe('a big hit is big FOR THE ATTACKER (#110)', () => {
  const hit = (assailantName: string, damage: number) =>
    ev({ payload: { assailantName, damage } });

  it('says nothing about an attacker it has never seen', () => {
    // One swing is not a baseline. Staying quiet beats guessing.
    const history = createDamageHistory();
    expect(classifyHighlight(hit('Res', 12), history)).toBe(null);
  });

  it("flags a beginner's best swing even though it barely dents a boss", () => {
    // The whole point of the change: measured against the boss's 53 max hp this would
    // never have qualified, but 9 is more than half again what Res normally manages.
    const history = createDamageHistory();
    classifyHighlight(hit('Res', 4), history);
    classifyHighlight(hit('Res', 5), history);
    expect(classifyHighlight(hit('Res', 9), history)?.kind).toBe('bigHit');
  });

  it("ignores a boss's routine hit even though it is a bigger number", () => {
    const history = createDamageHistory();
    classifyHighlight(hit('Seeskane Orcbane', 12), history);
    classifyHighlight(hit('Seeskane Orcbane', 14), history);
    expect(classifyHighlight(hit('Seeskane Orcbane', 13), history)).toBe(null);
  });

  it('keeps each attacker on its own baseline', () => {
    const history = createDamageHistory();
    classifyHighlight(hit('Seeskane Orcbane', 14), history);
    classifyHighlight(hit('Res', 4), history);
    // 8 is routine for the boss and a standout for Res.
    expect(classifyHighlight(hit('Seeskane Orcbane', 8), history)).toBe(null);
    expect(classifyHighlight(hit('Res', 8), history)?.kind).toBe('bigHit');
  });

  it('never flags chip damage, however far above an attacker\'s average', () => {
    const history = createDamageHistory();
    classifyHighlight(hit('Res', 1), history);
    classifyHighlight(hit('Res', 1), history);
    expect(classifyHighlight(hit('Res', BIG_HIT_FLOOR - 1), history)).toBe(null);
  });

  it('judges a hit before recording it, so it never compares against itself', () => {
    const history = createDamageHistory();
    classifyHighlight(hit('Res', 4), history);
    // 20 must be judged against the average of {4}, not of {4, 20}.
    expect(classifyHighlight(hit('Res', 20), history)?.kind).toBe('bigHit');
  });

  it('does nothing when no history is supplied', () => {
    expect(classifyHighlight(hit('Res', 40))).toBe(null);
  });
});

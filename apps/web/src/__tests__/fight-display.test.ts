import { describe, expect, it } from 'vitest';

import { fightSubtitle, fightTitleOneLine, type FightSummaryLike } from '../utils/fight-display.js';

const baseFight: FightSummaryLike = {
  outcome: 'cancelled',
  roundCount: 3,
  winnerMonsterName: null,
  loserMonsterName: null,
  cardDropName: null,
  participants: [],
};

describe('fight-display: cancelled fights', () => {
  it('fightSubtitle explains the fight was cancelled', () => {
    expect(fightSubtitle(baseFight)).toBe('Fight cancelled — an unexpected error cleared the ring');
  });

  it('fightTitleOneLine falls back to a readable label when there are no participants', () => {
    expect(fightTitleOneLine(baseFight)).toBe('Cancelled fight');
  });
});

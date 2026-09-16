import { describe, expect, it } from 'vitest';

import {
  fightSubtitle,
  fightTitleOneLine,
  type FightParticipantLike,
  type FightSummaryLike,
} from '../utils/fight-display.js';

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

describe('fight-display: round pluralization (#100)', () => {
  const win = (roundCount: number): FightSummaryLike => ({
    outcome: 'win',
    roundCount,
    winnerMonsterName: 'Dragon Blood',
    loserMonsterName: 'Stary',
    cardDropName: null,
    participants: [
      { monsterId: 'm1', monsterName: 'Dragon Blood', outcome: 'win' },
      { monsterId: 'm2', monsterName: 'Stary', outcome: 'loss' },
    ],
  });

  it('says "1 round" for a single-round fight', () => {
    expect(fightSubtitle(win(1))).toBe('Dragon Blood won vs Stary in 1 round');
  });

  it('still says "rounds" for longer fights', () => {
    expect(fightSubtitle(win(3))).toBe('Dragon Blood won vs Stary in 3 rounds');
  });

  it('pluralizes the permaDeath line too', () => {
    const f: FightSummaryLike = {
      outcome: 'permaDeath',
      roundCount: 1,
      winnerMonsterName: 'Ford',
      loserMonsterName: 'Everest',
      cardDropName: null,
      participants: [
        { monsterId: 'm1', monsterName: 'Ford', outcome: 'win' },
        { monsterId: 'm2', monsterName: 'Everest', outcome: 'permaDeath' },
      ],
    };
    expect(fightSubtitle(f)).toBe('Ford won in 1 round — ☠ Everest perished');
  });
});

describe('fight-display: a fled fight accounts for every contestant (#106)', () => {
  const threeWay = (thirdOutcome: FightParticipantLike['outcome']): FightSummaryLike => ({
    outcome: 'fled',
    roundCount: 2,
    winnerMonsterName: 'Ford',
    loserMonsterName: null,
    cardDropName: null,
    participants: [
      { monsterId: 'm1', monsterName: 'Everest', outcome: 'fled' },
      { monsterId: 'm2', monsterName: 'Ford', outcome: 'win' },
      { monsterId: 'm3', monsterName: 'Death Blood', outcome: thirdOutcome },
    ],
  });

  it('names the monster who lost rather than dropping it from the summary', () => {
    // The title renders "Everest vs Ford vs Death Blood", so a subtitle that never
    // mentions Death Blood reads as though it was not in the fight.
    expect(fightSubtitle(threeWay('loss'))).toBe(
      'Everest fled from Ford · also fought: Death Blood'
    );
  });

  it('accounts for a drawn third contestant too', () => {
    expect(fightSubtitle(threeWay('draw'))).toBe(
      'Everest fled from Ford · also fought: Death Blood'
    );
  });

  it('adds nothing when every contestant is already named', () => {
    const f: FightSummaryLike = {
      outcome: 'fled',
      roundCount: 1,
      winnerMonsterName: 'Ford',
      loserMonsterName: null,
      cardDropName: null,
      participants: [
        { monsterId: 'm1', monsterName: 'Everest', outcome: 'fled' },
        { monsterId: 'm2', monsterName: 'Ford', outcome: 'win' },
      ],
    };
    expect(fightSubtitle(f)).toBe('Everest fled from Ford');
  });
});

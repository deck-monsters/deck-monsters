import { describe, expect, it } from 'vitest';
import {
  DENSE_ABOVE,
  describeContestant,
  formatLevel,
  isDense,
  metaParts,
  teamsAreRelevant,
  teamsInPlay,
  turnPositions,
} from '../components/roster-model.js';
import type { RingContestantSnapshot } from '../components/RingRoster.js';

function c(over: Partial<RingContestantSnapshot> = {}): RingContestantSnapshot {
  return {
    name: 'Stonefang', icon: '🐍', creatureType: 'Basilisk', level: 2,
    hp: 40, maxHp: 50, ac: 9, dead: false, isBoss: false,
    team: null, owner: 'Ada', userId: 'u1', ...over,
  };
}

describe('formatLevel', () => {
  it('uses the lexicon spellings', () => {
    // `Lvl 3` compact, never `L3`; level zero is not a level but "Beginner".
    expect(formatLevel(3)).toBe('Lvl 3');
    expect(formatLevel(0)).toBe('Beginner');
  });
});

describe('density', () => {
  it('stays comfortable up to the threshold and goes dense above it', () => {
    expect(isDense(DENSE_ABOVE)).toBe(false);
    expect(isDense(DENSE_ABOVE + 1)).toBe(true);
  });
});

describe('teamsAreRelevant', () => {
  it('is false with no teams at all', () => {
    expect(teamsAreRelevant([c(), c({ name: 'Aqim' })])).toBe(false);
  });

  it('is false when everyone shares one team', () => {
    // Common Cause puts every player on The Alliance; repeating it down the list says
    // nothing, so the whole column disappears.
    expect(teamsAreRelevant([
      c({ team: 'The Alliance' }),
      c({ name: 'Aqim', team: 'The Alliance' }),
    ])).toBe(false);
  });

  it('is true once two teams are standing', () => {
    expect(teamsAreRelevant([
      c({ team: 'Gryffindor' }),
      c({ name: 'Aqim', team: 'Slytherin' }),
    ])).toBe(true);
  });

  it('ignores a team that has been wiped out', () => {
    expect(teamsAreRelevant([
      c({ team: 'Gryffindor' }),
      c({ name: 'Aqim', team: 'Slytherin', hp: 0, dead: true }),
    ])).toBe(false);
  });

  it('lists teams in roster order, without duplicates', () => {
    expect(teamsInPlay([
      c({ team: 'Slytherin' }),
      c({ name: 'A', team: 'Gryffindor' }),
      c({ name: 'B', team: 'Slytherin' }),
      c({ name: 'C', team: null }),
    ])).toEqual(['Slytherin', 'Gryffindor']);
  });
});

describe('turnPositions', () => {
  it('marks the acting contestant and whoever follows in roster order', () => {
    // Roster order IS play order: Ring.doAction shifts contestants off the same array
    // this list mirrors. Nothing else on screen carries that, which is why the roster
    // must never be sorted or grouped.
    const list = [c({ name: 'A' }), c({ name: 'B', acting: true }), c({ name: 'C' })];
    const at = turnPositions(list);

    expect(at.get(list[1]!)).toBe('acting');
    expect(at.get(list[2]!)).toBe('next');
    expect(at.get(list[0]!)).toBeNull();
  });

  it('wraps to the top of the round', () => {
    const list = [c({ name: 'A' }), c({ name: 'B' }), c({ name: 'C', acting: true })];
    const at = turnPositions(list);

    expect(at.get(list[0]!)).toBe('next');
  });

  it('skips the fallen when picking who is next, as the engine does', () => {
    const list = [
      c({ name: 'A', acting: true }),
      c({ name: 'B', hp: 0, dead: true }),
      c({ name: 'C' }),
    ];
    const at = turnPositions(list);

    expect(at.get(list[1]!)).toBeNull();
    expect(at.get(list[2]!)).toBe('next');
  });

  it('marks nobody next when only one contestant is still up', () => {
    const list = [c({ name: 'A', acting: true }), c({ name: 'B', hp: 0, dead: true })];
    const at = turnPositions(list);

    expect(at.get(list[0]!)).toBe('acting');
    expect([...at.values()].filter((v) => v === 'next')).toHaveLength(0);
  });

  it('marks nothing at all between fights, when nobody is acting', () => {
    const list = [c({ name: 'A' }), c({ name: 'B' })];

    expect([...turnPositions(list).values()].every((v) => v === null)).toBe(true);
  });

  it('never marks a fallen contestant as acting even if the payload says so', () => {
    const list = [c({ name: 'A', hp: 0, dead: true, acting: true }), c({ name: 'B' })];

    expect([...turnPositions(list).values()].every((v) => v === null)).toBe(true);
  });
});

describe('metaParts', () => {
  it('orders fields by how often they are needed mid-fight', () => {
    expect(metaParts(c({ team: 'Gryffindor' }), true).map((p) => p.kind))
      .toEqual(['beastmaster', 'level', 'team', 'ac']);
  });

  it('drops the team when it is not discriminating', () => {
    expect(metaParts(c({ team: 'Gryffindor' }), false).map((p) => p.kind))
      .toEqual(['beastmaster', 'level', 'ac']);
  });

  it('credits the house for a boss, which has no beastmaster', () => {
    const parts = metaParts(c({ isBoss: true, owner: null }), false);

    expect(parts[0]).toEqual({ kind: 'beastmaster', text: '👑 The Editor' });
  });

  it('omits the beastmaster entirely when there is none to name', () => {
    expect(metaParts(c({ owner: null }), false).map((p) => p.kind))
      .toEqual(['level', 'ac']);
  });

  it('never carries species — the row icon is what says that', () => {
    const text = metaParts(c(), true).map((p) => p.text).join(' ');

    expect(text).not.toContain('Basilisk');
  });
});

describe('describeContestant', () => {
  it('speaks the fields the visual row drops', () => {
    expect(describeContestant(c({ team: 'Gryffindor' }), 'acting'))
      .toBe('Stonefang, 40 of 50 hit points, Basilisk, Lvl 2, Ada, Gryffindor, armor class 9, acting now');
  });

  it('says fallen rather than defeated', () => {
    expect(describeContestant(c({ hp: 0, dead: true }), null)).toContain('fallen');
  });

  it('announces who is up next', () => {
    expect(describeContestant(c(), 'next')).toContain('up next');
  });
});

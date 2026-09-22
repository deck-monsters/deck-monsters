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
  it('only asks for compression above the threshold', () => {
    // A request, not a layout: the stylesheet honours it in the single-column tier only,
    // so a big fight on a wide pane gets extra columns rather than squashed rows.
    expect(isDense(DENSE_ABOVE)).toBe(false);
    expect(isDense(DENSE_ABOVE + 1)).toBe(true);
  });

  it('never asks below a full ring, since twelve is the cap', () => {
    expect(isDense(12)).toBe(true);
    expect(isDense(2)).toBe(false);
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

  it('leaves a wiped-out team out of the legend', () => {
    // The legend is labelled "Teams in play"; a team with nobody standing is not in play.
    expect(teamsInPlay([
      c({ team: 'Gryffindor' }),
      c({ name: 'A', team: 'Slytherin', hp: 0, dead: true }),
    ])).toEqual(['Gryffindor']);
  });
});

describe('turnPositions', () => {
  it('marks the acting contestant and nobody else', () => {
    // Roster order IS play order: Ring.doAction shifts contestants off the same array
    // this list mirrors. Nothing else on screen carries that, which is why the roster
    // must never be sorted or grouped.
    const list = [c({ name: 'A' }), c({ name: 'B', acting: true }), c({ name: 'C' })];
    const at = turnPositions(list);

    expect(at.get(list[1]!)).toBe('acting');
    expect(at.get(list[0]!)).toBeNull();
    expect(at.get(list[2]!)).toBeNull();
  });

  it('does not predict who acts next', () => {
    // It used to, and the prediction was wrong: the engine's queue filter is
    // `!dead && !fled`, and ring.state publishes `dead` but not `fled`, so a monster
    // that had fled stayed in the roster looking alive and got marked up-next despite
    // never acting again. Restoring the cue needs the engine to publish the real actor.
    const list = [c({ name: 'A', acting: true }), c({ name: 'B' }), c({ name: 'C' })];
    const marked = [...turnPositions(list).values()].filter(Boolean);

    expect(marked).toEqual(['acting']);
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

  it('says nothing about turn order when the contestant is not acting', () => {
    expect(describeContestant(c(), null)).not.toContain('acting');
  });
});

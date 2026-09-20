import { describe, expect, it } from 'vitest';
import {
  EMPTY_FIGHT_SCENE,
  nextDeadline,
  type RingStateFrame,
  reduce,
  settle,
} from '../animations/pixel-fight/state.js';
import type { RingContestantSnapshot } from '../components/RingRoster.js';
import type { TrackedRingFeedEvent } from '../hooks/useRingFeed.js';

const roster: RingContestantSnapshot[] = [
  {
    name: 'Aqim',
    icon: '🐍',
    creatureType: 'Basilisk',
    level: 4,
    hp: 30,
    maxHp: 30,
    ac: 12,
    dead: false,
    isBoss: false,
    team: null,
    owner: 'Viewer',
    userId: 'viewer',
  },
  {
    name: 'Mara',
    icon: '⚔️',
    creatureType: 'Gladiator',
    level: 3,
    hp: 22,
    maxHp: 22,
    ac: 11,
    dead: false,
    isBoss: false,
    team: null,
    owner: 'Opponent',
    userId: 'opponent',
  },
];

function stateFrame(contestants = roster): RingStateFrame {
  return { type: 'ring.state', contestants: [...contestants], viewerUserId: 'viewer' };
}

function combatEvent(combat: unknown, type: TrackedRingFeedEvent['data']['type'] = 'announce'): TrackedRingFeedEvent {
  return {
    id: crypto.randomUUID(),
    data: {
      id: crypto.randomUUID(),
      roomId: 'room-1',
      timestamp: 0,
      type,
      scope: 'public',
      text: '',
      payload: { combat },
    },
  };
}

function fightEvent(eventName: 'fightBegins' | 'fightConcludes'): TrackedRingFeedEvent {
  return {
    id: `fight-${eventName}`,
    data: {
      id: `fight-${eventName}`,
      roomId: 'room-1',
      timestamp: 0,
      type: 'ring.fight',
      scope: 'public',
      text: '',
      payload: { eventName },
    },
  };
}

function startedScene() {
  const withRoster = reduce(EMPTY_FIGHT_SCENE, stateFrame(), 0);
  return reduce(
    withRoster,
    fightEvent('fightBegins'),
    1,
  );
}

function settledStartedScene() {
  return settle(startedScene(), 401);
}

describe('pixel fight reducer', () => {
  it('reports and settles animation deadlines without needing another feed event', () => {
    const attacking = reduce(
      settledStartedScene(),
      combatEvent({ kind: 'card', actor: { name: 'Aqim' }, card: { name: 'Strike' } }, 'card.played'),
      500,
    );

    expect(nextDeadline(attacking)).toBe(900);
    expect(settle(attacking, 899).fighters[0]).toMatchObject({ anim: 'attack' });
    expect(settle(attacking, 900).fighters[0]).toMatchObject({ anim: 'idle' });
  });

  it('settles a hit after 250ms and removes a fleeing fighter after 400ms', () => {
    const hit = reduce(
      settledStartedScene(),
      combatEvent({
        kind: 'hit', actor: { name: 'Aqim' }, target: { name: 'Mara' }, damage: 8,
        prevHp: 22, hp: 14, maxHp: 22, selfInflicted: false,
      }),
      500,
    );
    const fleeing = reduce(
      settledStartedScene(),
      combatEvent({ kind: 'flee', actor: { name: 'Mara' }, target: { name: 'Mara' }, amount: 0 }),
      500,
    );

    expect(nextDeadline(hit)).toBe(750);
    expect(settle(hit, 750).fighters.find((fighter) => fighter.name === 'Mara')).toMatchObject({ anim: 'idle' });
    expect(nextDeadline(fleeing)).toBe(900);
    expect(settle(fleeing, 900).fighters.map((fighter) => fighter.name)).not.toContain('Mara');
  });

  it('settles a concluded fight inactive at its fade deadline without another event', () => {
    const fading = reduce(settledStartedScene(), fightEvent('fightConcludes'), 500);

    expect(nextDeadline(fading)).toBe(3_000);
    expect(settle(fading, 3_000)).toMatchObject({ active: false, fighters: [] });
  });

  it('starts from the latest ring roster and places the viewer team on the left', () => {
    const scene = startedScene();

    expect(scene.active).toBe(true);
    expect(scene.fighters).toMatchObject([
      { name: 'Aqim', hp: 30, maxHp: 30, side: 'left', anim: 'enter' },
      { name: 'Mara', hp: 22, maxHp: 22, side: 'right', anim: 'enter' },
    ]);
  });

  it('animates a card actor, then returns it to idle after 400ms', () => {
    const attacking = reduce(
      startedScene(),
      combatEvent({ kind: 'card', actor: { name: 'Aqim' }, card: { name: 'Strike' } }, 'card.played'),
      10,
    );
    expect(attacking.fighters[0]).toMatchObject({ name: 'Aqim', anim: 'attack' });

    const settled = reduce(attacking, stateFrame(), 410);
    expect(settled.fighters[0]).toMatchObject({ name: 'Aqim', anim: 'idle' });
  });

  it('flashes hit targets and accepts the DTO hp as the current value', () => {
    const scene = reduce(
      startedScene(),
      combatEvent({
        kind: 'hit',
        actor: { name: 'Aqim' },
        target: { name: 'Mara' },
        damage: 8,
        prevHp: 22,
        hp: 14,
        maxHp: 22,
        selfInflicted: false,
      }),
      10,
    );

    expect(scene.fighters.find((fighter) => fighter.name === 'Mara')).toMatchObject({
      hp: 14,
      maxHp: 22,
      anim: 'hit',
    });
  });

  it('keeps a death animation sticky while other animations settle', () => {
    const fainted = reduce(
      startedScene(),
      combatEvent({ kind: 'death', target: { name: 'Mara' }, destroyed: false }),
      10,
    );
    const settled = reduce(fainted, stateFrame(), 1_000);

    expect(settled.fighters.find((fighter) => fighter.name === 'Mara')).toMatchObject({ anim: 'faint' });
  });

  it('fades after a conclusion and becomes inactive when the fade ends', () => {
    const fading = reduce(
      startedScene(),
      fightEvent('fightConcludes'),
      100,
    );
    expect(fading).toMatchObject({ active: true, fadeOutAt: 2_600 });

    expect(reduce(fading, stateFrame(), 2_600).active).toBe(false);
  });

  it('uses a later ring.state frame as the hp source of truth without moving established fighters', () => {
    const afterHit = reduce(
      startedScene(),
      combatEvent({
        kind: 'hit',
        actor: { name: 'Aqim' },
        target: { name: 'Mara' },
        damage: 8,
        prevHp: 22,
        hp: 14,
        maxHp: 22,
        selfInflicted: false,
      }),
      10,
    );
    const updated = reduce(
      afterHit,
      stateFrame([
        { ...roster[0], hp: 29 },
        { ...roster[1], hp: 15, userId: 'viewer' },
      ]),
      20,
    );

    expect(updated.fighters.find((fighter) => fighter.name === 'Mara')).toMatchObject({
      hp: 15,
      side: 'right',
    });
  });

  it('flashes a delayed hit even when its actor had no preceding card', () => {
    const scene = reduce(
      startedScene(),
      combatEvent({
        kind: 'hit',
        actor: { name: 'Aqim' },
        target: { name: 'Mara' },
        damage: 4,
        prevHp: 22,
        hp: 18,
        maxHp: 22,
        selfInflicted: false,
      }),
      20,
    );

    expect(scene.fighters.find((fighter) => fighter.name === 'Mara')).toMatchObject({ hp: 18, anim: 'hit' });
  });

  it('returns an unmatched card actor to idle without blocking subsequent events', () => {
    const cardOnly = reduce(
      startedScene(),
      combatEvent({ kind: 'card', actor: { name: 'Aqim' }, card: { name: 'Brace' } }, 'card.played'),
      10,
    );
    const settled = reduce(cardOnly, stateFrame(), 410);
    const healed = reduce(
      settled,
      combatEvent({
        kind: 'heal',
        actor: { name: 'Mara' },
        target: { name: 'Mara' },
        amount: 2,
        hp: 24,
        maxHp: 22,
      }),
      420,
    );

    expect(healed.fighters.find((fighter) => fighter.name === 'Mara')).toMatchObject({ hp: 24 });
  });

  it('ignores combat actors that are not in the current roster', () => {
    const scene = reduce(
      startedScene(),
      combatEvent({
        kind: 'hit',
        actor: { name: 'Unknown' },
        target: { name: 'Missing' },
        damage: 8,
        prevHp: 10,
        hp: 2,
        maxHp: 10,
        selfInflicted: false,
      }),
      10,
    );

    expect(scene.fighters).toHaveLength(2);
    expect(scene.fighters.map((fighter) => fighter.name)).not.toContain('Missing');
  });

  it('places a boss added mid-fight into an actual free slot', () => {
    const boss = { ...roster[1], name: 'The Minotaur', creatureType: 'Minotaur', userId: 'boss' };
    const scene = reduce(startedScene(), stateFrame([...roster, boss]), 20);

    expect(scene.fighters.find((fighter) => fighter.name === boss.name)).toMatchObject({ side: 'right' });
    expect(scene.fighters).toHaveLength(3);
  });

  it('replaces a departed full-side fighter without exceeding eight sprites', () => {
    const left = Array.from({ length: 4 }, (_, index) => ({
      ...roster[0], name: `Left ${index}`, userId: 'viewer',
    }));
    const right = Array.from({ length: 4 }, (_, index) => ({
      ...roster[1], name: `Right ${index}`, userId: 'opponent',
    }));
    const current = reduce(reduce(EMPTY_FIGHT_SCENE, stateFrame([...left, ...right]), 0), fightEvent('fightBegins'), 1);
    const replacement = { ...right[3], name: 'New challenger' };
    const updated = reduce(current, stateFrame([...left, ...right.slice(0, 3), replacement]), 20);

    expect(updated.fighters).toHaveLength(8);
    expect(updated.fighters.find((fighter) => fighter.name === replacement.name)).toMatchObject({ side: 'right' });
  });

  it('reuses a fled fighter slot for a roster newcomer', () => {
    const fled = reduce(
      startedScene(),
      combatEvent({ kind: 'flee', actor: { name: 'Mara' }, target: { name: 'Mara' }, amount: 0 }),
      10,
    );
    const settled = settle(fled, 410);
    const newcomer = { ...roster[1], name: 'Jinn newcomer', creatureType: 'Jinn', userId: 'new' };
    const updated = reduce(settled, stateFrame([roster[0], newcomer]), 420);

    expect(updated.fighters.map((fighter) => fighter.name)).toEqual(['Aqim', 'Jinn newcomer']);
    expect(updated.fighters[1]).toMatchObject({ side: 'right' });
  });

  it.each([
    ['an unknown kind', { kind: 'future', actor: { name: 'Aqim' } }],
    ['a missing hit target', { kind: 'hit', actor: { name: 'Aqim' }, hp: 10, maxHp: 20, damage: 1 }],
    ['a non-numeric hit hp', { kind: 'hit', actor: { name: 'Aqim' }, target: { name: 'Mara' }, hp: '10', maxHp: 20, damage: 1 }],
    ['a null combat payload', null],
    ['a string combat payload', 'combat'],
  ])('leaves the scene unchanged for %s', (_label, combat) => {
    const scene = startedScene();

    expect(reduce(scene, combatEvent(combat), 10)).toBe(scene);
  });
});

import { describe, expect, it } from 'vitest';
import {
  EMPTY_FIGHT_SCENE,
  type RingStateFrame,
  reduce,
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

describe('pixel fight reducer', () => {
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
});

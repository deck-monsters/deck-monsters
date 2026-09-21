import { describe, expect, it } from 'vitest';
import {
  HIT_FLASH_MS,
  NO_ANIMATIONS,
  nextDeadline,
  poseFor,
  pruneToRoster,
  reduce,
  settle,
} from '../animations/pixel-fight/state.js';
import type { RingContestantSnapshot } from '../components/RingRoster.js';
import type { TrackedRingFeedEvent } from '../hooks/useRingFeed.js';

function contestant(name: string, dead = false): RingContestantSnapshot {
  return {
    name, icon: '', creatureType: 'Basilisk', level: 2, hp: dead ? 0 : 10, maxHp: 10,
    ac: 7, dead, isBoss: false, team: null, owner: 'someone', userId: 'u1',
  };
}

function combatEvent(combat: unknown): TrackedRingFeedEvent {
  return {
    id: crypto.randomUUID(),
    data: { type: 'announce', scope: 'public', text: '', payload: { combat } },
  } as unknown as TrackedRingFeedEvent;
}

describe('pixel fight animations', () => {
  it('idles a monster with no pose recorded', () => {
    expect(poseFor(NO_ANIMATIONS, contestant('Aster'), 0)).toEqual({ anim: 'idle', flash: false });
  });

  it('lunges the actor and recoils the target on one hit', () => {
    // One exchange should read as one exchange, not two unrelated twitches.
    const after = reduce(NO_ANIMATIONS, combatEvent({
      kind: 'hit', actor: { name: 'Aster' }, target: { name: 'Heyus' },
    }), 100);

    expect(poseFor(after, contestant('Aster'), 100).anim).toBe('attack');
    expect(poseFor(after, contestant('Heyus'), 100).anim).toBe('hit');
  });

  it('flashes a struck monster only for the first moments of the recoil', () => {
    const after = reduce(NO_ANIMATIONS, combatEvent({
      kind: 'hit', actor: { name: 'Aster' }, target: { name: 'Heyus' },
    }), 100);

    expect(poseFor(after, contestant('Heyus'), 100).flash).toBe(true);
    expect(poseFor(after, contestant('Heyus'), 100 + HIT_FLASH_MS).flash).toBe(false);
  });

  it('lunges on a card and on a miss', () => {
    for (const kind of ['card', 'miss'] as const) {
      const after = reduce(NO_ANIMATIONS, combatEvent({ kind, actor: { name: 'Aster' } }), 0);
      expect(poseFor(after, contestant('Aster'), 0).anim, kind).toBe('attack');
    }
  });

  it('lets a pose decay back to idle once its time is up', () => {
    const after = reduce(NO_ANIMATIONS, combatEvent({ kind: 'card', actor: { name: 'Aster' } }), 0);
    const deadline = nextDeadline(after)!;

    expect(poseFor(settle(after, deadline - 1), contestant('Aster'), 0).anim).toBe('attack');
    expect(poseFor(settle(after, deadline), contestant('Aster'), 0).anim).toBe('idle');
  });

  it('reports no deadline when nothing is mid-pose', () => {
    expect(nextDeadline(NO_ANIMATIONS)).toBeUndefined();
  });

  it('reads death from the roster, not from a stored pose', () => {
    // Storing `faint` would let a revived monster keep a stale fallen pose. The roster's
    // `dead` flag outlives any animation, so it is the source of truth.
    const struck = reduce(NO_ANIMATIONS, combatEvent({
      kind: 'hit', actor: { name: 'Aster' }, target: { name: 'Heyus' },
    }), 0);

    expect(poseFor(struck, contestant('Heyus', true), 0).anim).toBe('faint');
    expect(poseFor(struck, contestant('Heyus', false), 0).anim).toBe('hit');
  });

  it('does not pose on heal or death — the roster already shows both', () => {
    for (const combat of [
      { kind: 'heal', target: { name: 'Aster' } },
      { kind: 'death', target: { name: 'Aster' } },
    ]) {
      expect(reduce(NO_ANIMATIONS, combatEvent(combat), 0)).toEqual(NO_ANIMATIONS);
    }
  });

  it('forgets monsters that have left the ring', () => {
    const posed = reduce(NO_ANIMATIONS, combatEvent({ kind: 'card', actor: { name: 'Gone' } }), 0);

    expect(pruneToRoster(posed, [contestant('Aster')])).toEqual({});
    // Same roster in, same object out: no needless re-render.
    const kept = pruneToRoster(posed, [contestant('Gone')]);
    expect(kept).toBe(posed);
  });

  it.each([
    ['an unknown kind', { kind: 'nonsense', actor: { name: 'Aster' } }],
    ['a hit with no target', { kind: 'hit', actor: { name: 'Aster' } }],
    ['a card with no actor', { kind: 'card' }],
    ['a null payload', null],
    ['a string payload', 'combat'],
  ])('ignores %s', (_label, combat) => {
    expect(reduce(NO_ANIMATIONS, combatEvent(combat), 0)).toEqual(NO_ANIMATIONS);
  });
});

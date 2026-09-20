import type { CombatPayload } from '@deck-monsters/engine';
import type { RingContestantSnapshot } from '../../components/RingRoster.js';
import type { TrackedRingFeedEvent } from '../../hooks/useRingFeed.js';

export type FighterAnimation = 'enter' | 'idle' | 'attack' | 'hit' | 'faint' | 'flee';

export interface FightFighter {
  name: string;
  creatureType: string;
  side: 'left' | 'right';
  hp: number;
  maxHp: number;
  anim: FighterAnimation;
  animStartedAt: number;
}

export interface RingStateFrame {
  type: 'ring.state';
  contestants: RingContestantSnapshot[];
  viewerUserId: string | null;
}

export interface FightScene {
  active: boolean;
  fighters: FightFighter[];
  fadeOutAt?: number;
  /** Latest authoritative roster frame; combat DTOs only animate deltas between frames. */
  roster: RingContestantSnapshot[];
  viewerUserId: string | null;
}

export const EMPTY_FIGHT_SCENE: FightScene = {
  active: false,
  fighters: [],
  roster: [],
  viewerUserId: null,
};

const ENTER_MS = 400;
const ATTACK_MS = 400;
const HIT_MS = 250;
const FLEE_MS = 400;
const MAX_FIGHTERS_PER_SIDE = 4;

function animationDuration(animation: FighterAnimation): number | null {
  switch (animation) {
    case 'enter':
      return ENTER_MS;
    case 'attack':
      return ATTACK_MS;
    case 'hit':
      return HIT_MS;
    case 'flee':
      return FLEE_MS;
    default:
      return null;
  }
}

function settleAnimations(scene: FightScene, now: number): FightScene {
  if (scene.fadeOutAt !== undefined && now >= scene.fadeOutAt) {
    return { ...scene, active: false, fighters: [], fadeOutAt: undefined };
  }

  let changed = false;
  const fighters = scene.fighters
    .filter((fighter) => {
      const duration = animationDuration(fighter.anim);
      const shouldRemove = fighter.anim === 'flee' && duration !== null && now >= fighter.animStartedAt + duration;
      changed ||= shouldRemove;
      return !shouldRemove;
    })
    .map((fighter) => {
      const duration = animationDuration(fighter.anim);
      if (duration === null || now < fighter.animStartedAt + duration) return fighter;
      changed = true;
      return { ...fighter, anim: 'idle' as const, animStartedAt: now };
    });

  return changed ? { ...scene, fighters } : scene;
}

function sideFor(
  contestant: RingContestantSnapshot,
  viewerUserId: string | null,
  leftCount: number,
  rightCount: number,
  hasViewerMonster: boolean,
): 'left' | 'right' | null {
  if (contestant.userId === viewerUserId && viewerUserId !== null) {
    return leftCount < MAX_FIGHTERS_PER_SIDE ? 'left' : null;
  }
  if (hasViewerMonster) return rightCount < MAX_FIGHTERS_PER_SIDE ? 'right' : null;
  if (leftCount >= MAX_FIGHTERS_PER_SIDE && rightCount >= MAX_FIGHTERS_PER_SIDE) return null;
  if (leftCount >= MAX_FIGHTERS_PER_SIDE) return 'right';
  if (rightCount >= MAX_FIGHTERS_PER_SIDE) return 'left';
  return leftCount <= rightCount ? 'left' : 'right';
}

function fightersFromRoster(
  roster: RingContestantSnapshot[],
  priorFighters: FightFighter[],
  viewerUserId: string | null,
  now: number,
  initialAnimation: FighterAnimation,
): FightFighter[] {
  const existing = new Map(priorFighters.map((fighter) => [fighter.name, fighter]));
  const hasViewerMonster = roster.some((contestant) => contestant.userId === viewerUserId && viewerUserId !== null);
  let leftCount = priorFighters.filter((fighter) => fighter.side === 'left').length;
  let rightCount = priorFighters.filter((fighter) => fighter.side === 'right').length;

  // The arena can hold twelve contestants, but this purely decorative layer shows four
  // per side. Keeping existing sides prevents a boss spawn or flee from making sprites hop.
  return roster.flatMap((contestant) => {
    const fighter = existing.get(contestant.name);
    if (fighter) {
      const anim = contestant.dead && fighter.anim !== 'faint' ? 'faint' : fighter.anim;
      return [{
        ...fighter,
        creatureType: contestant.creatureType,
        hp: contestant.hp,
        maxHp: contestant.maxHp,
        anim,
        animStartedAt: anim === fighter.anim ? fighter.animStartedAt : now,
      }];
    }

    const side = sideFor(contestant, viewerUserId, leftCount, rightCount, hasViewerMonster);
    if (side === null) return [];
    if (side === 'left') leftCount += 1;
    else rightCount += 1;
    return [{
      name: contestant.name,
      creatureType: contestant.creatureType,
      side,
      hp: contestant.hp,
      maxHp: contestant.maxHp,
      anim: contestant.dead ? 'faint' : initialAnimation,
      animStartedAt: now,
    }];
  });
}

function isRingStateFrame(event: TrackedRingFeedEvent | RingStateFrame): event is RingStateFrame {
  return event.type === 'ring.state' && 'contestants' in event;
}

function combatFrom(event: TrackedRingFeedEvent): CombatPayload | null {
  const combat = (event.data.payload as { combat?: unknown }).combat;
  if (!combat || typeof combat !== 'object' || !('kind' in combat)) return null;
  return combat as CombatPayload;
}

function hasFightEvent(event: TrackedRingFeedEvent, eventName: string): boolean {
  return event.data.type === 'ring.fight'
    && (event.data.payload as { eventName?: unknown }).eventName === eventName;
}

function updateFighter(
  scene: FightScene,
  name: string,
  update: (fighter: FightFighter) => FightFighter,
): FightScene {
  if (!scene.fighters.some((fighter) => fighter.name === name)) return scene;
  return { ...scene, fighters: scene.fighters.map((fighter) => fighter.name === name ? update(fighter) : fighter) };
}

export function reduce(
  currentScene: FightScene,
  event: TrackedRingFeedEvent | RingStateFrame,
  now: number,
): FightScene {
  let scene = settleAnimations(currentScene, now);

  if (isRingStateFrame(event)) {
    const roster = event.contestants;
    return {
      ...scene,
      roster,
      viewerUserId: event.viewerUserId,
      fighters: scene.active
        ? fightersFromRoster(roster, scene.fighters, event.viewerUserId, now, 'enter')
        : scene.fighters,
    };
  }

  if (hasFightEvent(event, 'fightBegins')) {
    return {
      ...scene,
      active: true,
      fadeOutAt: undefined,
      fighters: fightersFromRoster(scene.roster, [], scene.viewerUserId, now, 'enter'),
    };
  }

  if (hasFightEvent(event, 'fightConcludes') || event.data.type === 'ring.fightResolved') {
    return scene.active ? { ...scene, fadeOutAt: now + 2_500 } : scene;
  }

  if (!scene.active) return scene;
  const combat = combatFrom(event);
  if (!combat) return scene;

  switch (combat.kind) {
    case 'card':
      return updateFighter(scene, combat.actor.name, (fighter) => ({
        ...fighter, anim: 'attack', animStartedAt: now,
      }));
    case 'hit':
      return updateFighter(scene, combat.target.name, (fighter) => ({
        ...fighter,
        hp: combat.hp,
        maxHp: combat.maxHp,
        anim: 'hit',
        animStartedAt: now,
      }));
    case 'miss':
      return updateFighter(scene, combat.actor.name, (fighter) => ({
        ...fighter, anim: 'attack', animStartedAt: now,
      }));
    case 'heal':
      return updateFighter(scene, combat.target.name, (fighter) => ({
        ...fighter, hp: combat.hp, maxHp: combat.maxHp,
      }));
    case 'death':
      return updateFighter(scene, combat.target.name, (fighter) => ({
        ...fighter, anim: 'faint', animStartedAt: now,
      }));
    case 'flee':
      return updateFighter(scene, combat.actor.name, (fighter) => ({
        ...fighter, anim: 'flee', animStartedAt: now,
      }));
  }
}

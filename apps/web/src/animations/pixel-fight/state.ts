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
  /**
   * When this fighter last did or suffered something — set by attack/hit/faint/flee and
   * deliberately *not* by settling back to idle. The compact layout shows one fighter per
   * side and picks by this, so the pair in the current exchange is on screen and the
   * choice holds until a genuinely new exchange happens. Reusing `animStartedAt` would
   * churn, because settling to idle restamps it.
   */
  lastActionAt: number;
}

export interface RingStateFrame {
  type: 'ring.state';
  contestants: RingContestantSnapshot[];
  viewerUserId: string | null;
  /**
   * "A fight is running right now", straight off the ring.state payload — and
   * deliberately a tri-state. The field is optional on the wire (older payloads and the
   * polled seed omit it), so `undefined` means *unknown* and must not be read as "no
   * fight": collapsing the stage on a missing field would kill a live fight's animation.
   * Only an explicit `false` retires the scene.
   */
  inEncounter?: boolean;
}

export interface FightScene {
  active: boolean;
  fighters: FightFighter[];
  fadeOutAt?: number;
  /** Set on a knockout; the stage flashes once and the renderer ignores it. */
  pulseAt?: number;
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

/** How long the closing poses stay up after a fight ends. */
export const FADE_MS = 2_500;

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

export function settle(scene: FightScene, now: number): FightScene {
  if (scene.fadeOutAt !== undefined && now >= scene.fadeOutAt) {
    return { ...scene, active: false, fighters: [], fadeOutAt: undefined, pulseAt: undefined };
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

export function nextDeadline(scene: FightScene): number | undefined {
  const animationDeadlines = scene.fighters.flatMap((fighter) => {
    const duration = animationDuration(fighter.anim);
    return duration === null ? [] : [fighter.animStartedAt + duration];
  });
  if (scene.fadeOutAt !== undefined) animationDeadlines.push(scene.fadeOutAt);
  return animationDeadlines.length === 0 ? undefined : Math.min(...animationDeadlines);
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
  const retainedNames = new Set(roster.map((contestant) => contestant.name));
  const retained = priorFighters.filter((fighter) => retainedNames.has(fighter.name));
  let leftCount = retained.filter((fighter) => fighter.side === 'left').length;
  let rightCount = retained.filter((fighter) => fighter.side === 'right').length;

  // The ring can hold twelve contestants, but this purely decorative layer shows four
  // per side. Keeping existing sides prevents a boss spawn or flee from making sprites hop.
  return roster.flatMap((contestant) => {
    const fighter = existing.get(contestant.name);
    if (fighter) {
      const anim = contestant.dead && fighter.anim !== 'faint' ? 'faint' : fighter.anim;
      const changed = anim !== fighter.anim;
      return [{
        ...fighter,
        creatureType: contestant.creatureType,
        hp: contestant.hp,
        maxHp: contestant.maxHp,
        anim,
        animStartedAt: changed ? now : fighter.animStartedAt,
        lastActionAt: changed ? now : fighter.lastActionAt,
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
      lastActionAt: now,
    }];
  });
}

function isRingStateFrame(event: TrackedRingFeedEvent | RingStateFrame): event is RingStateFrame {
  return 'type' in event && event.type === 'ring.state' && 'contestants' in event;
}

type Combat = {
  kind: 'card' | 'hit' | 'miss' | 'heal' | 'death' | 'flee';
  actor?: { name: string };
  target?: { name: string };
  hp?: number;
  maxHp?: number;
  damage?: number;
  amount?: number;
};

function hasNamedParticipant(value: unknown): value is { name: string } {
  return typeof value === 'object'
    && value !== null
    && 'name' in value
    && typeof value.name === 'string';
}

function hasNumbers(value: Record<string, unknown>, ...keys: string[]): boolean {
  return keys.every((key) => typeof value[key] === 'number');
}

function combatFrom(event: TrackedRingFeedEvent): Combat | null {
  const combat = (event.data.payload as { combat?: unknown }).combat;
  if (!combat || typeof combat !== 'object' || !('kind' in combat) || typeof combat.kind !== 'string') return null;
  const record = combat as Record<string, unknown>;
  const actor = hasNamedParticipant(record.actor) ? record.actor : undefined;
  const target = hasNamedParticipant(record.target) ? record.target : undefined;

  switch (record.kind) {
    case 'card':
    case 'miss':
    case 'flee':
      return actor ? { kind: record.kind, actor } : null;
    case 'hit':
      return actor && target && hasNumbers(record, 'hp', 'maxHp', 'damage')
        ? { kind: 'hit', actor, target, hp: record.hp as number, maxHp: record.maxHp as number, damage: record.damage as number }
        : null;
    case 'heal':
      return actor && target && hasNumbers(record, 'hp', 'maxHp', 'amount')
        ? { kind: 'heal', actor, target, hp: record.hp as number, maxHp: record.maxHp as number, amount: record.amount as number }
        : null;
    case 'death':
      return target ? { kind: 'death', target } : null;
    default:
      return null;
  }
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
  let scene = settle(currentScene, now);

  if (isRingStateFrame(event)) {
    const roster = event.contestants;
    // The ring empties as the fight concludes, and that frame lands inside the fade
    // window; keep the closing poses (including the fallen one) on screen until the fade
    // ends rather than blanking the canvas a beat before it goes.
    const fading = scene.active && scene.fadeOutAt !== undefined;
    const base = { ...scene, roster, viewerUserId: event.viewerUserId };

    // Adopting a fight already in progress. `fightBegins` is a one-shot live event, so
    // opening the room mid-fight — or returning to the tab after the phone backgrounded
    // it — left the scene dark until the *next* fight started, which on a phone meant
    // essentially never. `inEncounter` is authoritative, is already on every ring.state
    // frame, and spans the whole fight (Ring.startEncounter/endEncounter), so joining
    // late is just another way to arrive at an active scene.
    if (!scene.active && event.inEncounter === true && roster.some((contestant) => !contestant.dead)) {
      return {
        ...base,
        active: true,
        fadeOutAt: undefined,
        fighters: fightersFromRoster(roster, [], event.viewerUserId, now, 'enter'),
      };
    }

    // The converse: the fight ended while we were away, so `fightConcludes` never
    // reached this client. Retire the scene the way that event would have instead of
    // leaving fighters posed on screen indefinitely.
    if (scene.active && !fading && event.inEncounter === false) {
      return { ...base, fadeOutAt: now + FADE_MS };
    }

    return {
      ...base,
      fighters: scene.active && !fading
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
    return scene.active ? { ...scene, fadeOutAt: now + FADE_MS } : scene;
  }

  if (!scene.active) return scene;
  const combat = combatFrom(event);
  if (!combat) return scene;

  switch (combat.kind) {
    case 'card':
      return updateFighter(scene, combat.actor!.name, (fighter) => ({
        ...fighter, anim: 'attack', animStartedAt: now, lastActionAt: now,
      }));
    case 'hit':
      return updateFighter(scene, combat.target!.name, (fighter) => ({
        ...fighter,
        hp: combat.hp!,
        maxHp: combat.maxHp!,
        anim: 'hit',
        animStartedAt: now,
        lastActionAt: now,
      }));
    case 'miss':
      return updateFighter(scene, combat.actor!.name, (fighter) => ({
        ...fighter, anim: 'attack', animStartedAt: now, lastActionAt: now,
      }));
    case 'heal':
      return updateFighter(scene, combat.target!.name, (fighter) => ({
        ...fighter, hp: combat.hp!, maxHp: combat.maxHp!,
      }));
    case 'death': {
      // A knockout is the beat worth looking up for; the stage flashes once.
      const downed = updateFighter(scene, combat.target!.name, (fighter) => ({
        ...fighter, anim: 'faint', animStartedAt: now, lastActionAt: now,
      }));
      return downed === scene ? scene : { ...downed, pulseAt: now };
    }
    case 'flee':
      return updateFighter(scene, combat.actor!.name, (fighter) => ({
        ...fighter, anim: 'flee', animStartedAt: now, lastActionAt: now,
      }));
    default:
      return scene;
  }
}

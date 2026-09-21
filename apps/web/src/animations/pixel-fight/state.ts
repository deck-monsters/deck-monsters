import type { TrackedRingFeedEvent } from '../../hooks/useRingFeed.js';
import type { RingContestantSnapshot } from '../../components/RingRoster.js';

export type FighterAnimation = 'idle' | 'attack' | 'hit' | 'faint' | 'flee';

export interface FighterPose {
  anim: FighterAnimation;
  /** `performance.now()` when the pose began — drives decay and the hit flash. */
  startedAt: number;
}

/**
 * Transient poses only, keyed by the monster's given name (what combat DTOs carry).
 *
 * Idle is the absence of an entry and `faint` is never stored: the roster already knows
 * who is dead, so `poseFor` reads that flag instead. Storing it would mean a revived
 * monster could keep a stale fallen pose, which is exactly the sort of bug the old
 * side-allocating scene had.
 *
 * This replaced a full scene model — fighters assigned to a left or right side, capped at
 * four each, with an `active` flag and a fade timer — that existed only to drive a
 * separate canvas band. The roster is the authoritative list of who is in the ring, so
 * none of that is needed to animate a sprite sitting in a roster row.
 */
export type FightAnimations = Readonly<Record<string, FighterPose>>;

export const NO_ANIMATIONS: FightAnimations = {};

const ATTACK_MS = 400;
const HIT_MS = 250;
const FLEE_MS = 400;

/** How long the renderer flashes a struck monster white. */
export const HIT_FLASH_MS = 130;

function durationOf(anim: FighterAnimation): number | null {
  switch (anim) {
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

/** Drop poses whose time is up; they fall back to idle by no longer being present. */
export function settle(animations: FightAnimations, now: number): FightAnimations {
  let changed = false;
  const next: Record<string, FighterPose> = {};
  for (const [name, pose] of Object.entries(animations)) {
    const duration = durationOf(pose.anim);
    if (duration !== null && now >= pose.startedAt + duration) {
      changed = true;
      continue;
    }
    next[name] = pose;
  }
  return changed ? next : animations;
}

/** When the next pose expires, so the caller can wake exactly once to settle it. */
export function nextDeadline(animations: FightAnimations): number | undefined {
  const deadlines = Object.values(animations).flatMap((pose) => {
    const duration = durationOf(pose.anim);
    return duration === null ? [] : [pose.startedAt + duration];
  });
  return deadlines.length === 0 ? undefined : Math.min(...deadlines);
}

/** Forget monsters that have left the ring, so the map cannot grow without bound. */
export function pruneToRoster(
  animations: FightAnimations,
  contestants: RingContestantSnapshot[],
): FightAnimations {
  const present = new Set(contestants.map((contestant) => contestant.name));
  const names = Object.keys(animations);
  if (names.every((name) => present.has(name))) return animations;
  const next: Record<string, FighterPose> = {};
  for (const name of names) if (present.has(name)) next[name] = animations[name]!;
  return next;
}

/**
 * The pose to draw for one contestant. Death wins over any transient pose: the roster's
 * `dead` flag is authoritative and outlives the animation map.
 */
export function poseFor(
  animations: FightAnimations,
  contestant: Pick<RingContestantSnapshot, 'name' | 'dead'>,
  now: number,
): { anim: FighterAnimation; flash: boolean } {
  if (contestant.dead) return { anim: 'faint', flash: false };
  const pose = animations[contestant.name];
  if (!pose) return { anim: 'idle', flash: false };
  return { anim: pose.anim, flash: pose.anim === 'hit' && now - pose.startedAt < HIT_FLASH_MS };
}

type Combat = {
  kind: 'card' | 'hit' | 'miss' | 'heal' | 'death' | 'flee';
  actor?: { name: string };
  target?: { name: string };
};

function hasNamedParticipant(value: unknown): value is { name: string } {
  return typeof value === 'object'
    && value !== null
    && 'name' in value
    && typeof value.name === 'string';
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
      return actor && target ? { kind: 'hit', actor, target } : null;
    case 'heal':
    case 'death':
      return target ? { kind: record.kind, target } : null;
    default:
      return null;
  }
}

function pose(
  animations: FightAnimations,
  name: string,
  anim: FighterAnimation,
  now: number,
): FightAnimations {
  return { ...animations, [name]: { anim, startedAt: now } };
}

/**
 * Fold one ring-feed event into the animation map.
 *
 * Unlike the old scene reducer this has no notion of a fight being "active": the roster
 * decides who is on screen and a monster with no entry simply idles, so there is nothing
 * to switch on and nothing to miss by arriving mid-fight.
 */
export function reduce(
  animations: FightAnimations,
  event: TrackedRingFeedEvent,
  now: number,
): FightAnimations {
  const settled = settle(animations, now);
  const combat = combatFrom(event);
  if (!combat) return settled;

  switch (combat.kind) {
    case 'card':
    case 'miss':
      return pose(settled, combat.actor!.name, 'attack', now);
    case 'hit':
      // The striker lunges and the struck monster recoils, so one exchange reads as one
      // exchange rather than two unrelated twitches.
      return pose(pose(settled, combat.actor!.name, 'attack', now), combat.target!.name, 'hit', now);
    case 'flee':
      return pose(settled, combat.actor!.name, 'flee', now);
    case 'heal':
    case 'death':
      // Both are reflected by the roster itself — the bar refills, the row goes dead.
      return settled;
    default:
      return settled;
  }
}

import type { GameEvent } from '@deck-monsters/server/types';

const hoverFmt = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'medium',
});

/** Full absolute time for tooltips / `title` (locale-aware). */
export function formatEventHoverTitle(ms: number): string {
  return hoverFmt.format(new Date(ms));
}

export function eventTimestampIso(ms: number): string {
  return new Date(ms).toISOString();
}

export type KeyRingMeta = { label: string };

/**
 * Ring public feed: highlight timestamps for join/leave/fight start/end only.
 * `ring.fight` from `fightConcludes` sets `payload.eventName === 'fightConcludes'`.
 */
export function getKeyRingEventMeta(event: GameEvent): KeyRingMeta | null {
  const { type, payload } = event;
  const p = (payload ?? {}) as Record<string, unknown>;

  if (type === 'ring.add') return { label: 'Joined' };
  if (type === 'ring.remove') return { label: 'Left' };

  if (type === 'ring.fight') {
    if (p['eventName'] === 'fightConcludes') return { label: 'Fight ended' };
    return { label: 'Fight began' };
  }

  return null;
}

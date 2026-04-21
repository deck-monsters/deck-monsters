import type { GameEvent } from '@deck-monsters/server/types';

const HIDDEN_RING_EVENT_TYPES = new Set<string>([
  // Internal analytics event; users already see flavorful fight-conclusion text.
  'ring.fightResolved',
  // Private console reconnect notice; never belongs in the public ring feed.
  'system.gap',
]);

export function shouldRenderRingEvent(event: Pick<GameEvent, 'type'>): boolean {
  return !HIDDEN_RING_EVENT_TYPES.has(event.type);
}

import { useSyncExternalStore } from 'react';
import type { RingContestantSnapshot } from '../components/RingRoster.js';
import type { KnownMonster } from '../utils/monster-mentions.js';

/**
 * Every monster each room's Ring has shown this session, for drawing their sprites wherever
 * narration names them — the Ring feed, the Console and the fight history (roadmap 24).
 *
 * A shared store rather than state inside the Ring pane, because those other panes render
 * the same narration and have no roster of their own. The Ring pane records; anyone reads.
 *
 * Accumulated rather than taken from the current roster, because narration outlives the
 * fight: once the ring clears, the lines above still name the monsters that were in it.
 * Keyed by name — the only identifier narration carries — so a later snapshot (a new
 * appearance, a changed icon) replaces the old entry.
 *
 * **Keyed by room.** Room scoping (docs/room-scoping.md) is a hard rule: one room's monsters
 * must never decorate another room's text, and a reader only ever asks for its own room.
 */
interface RoomMonsters {
  byName: Map<string, KnownMonster>;
  /** Replaced, never mutated, when something changes — consumers compare it by identity. */
  list: KnownMonster[];
}

const rooms = new Map<string, RoomMonsters>();
const listeners = new Set<() => void>();
const NONE: KnownMonster[] = [];

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Records the monsters in a `ring.state` snapshot. Call it from an effect, not during render:
 * it notifies other components. A no-op when nothing changed, which is almost every tick —
 * an HP change is not a change here.
 */
export function rememberMonsters(roomId: string, contestants: readonly RingContestantSnapshot[]): void {
  let room = rooms.get(roomId);
  let changed = false;
  for (const { name, icon, creatureType, appearance } of contestants) {
    if (!name || !icon) continue;
    if (!room) {
      room = { byName: new Map(), list: NONE };
      rooms.set(roomId, room);
    }
    const known = room.byName.get(name);
    if (known && known.icon === icon && known.creatureType === creatureType && known.appearance === appearance) {
      continue;
    }
    room.byName.set(name, { name, icon, creatureType, appearance });
    changed = true;
  }
  if (!room || !changed) return;
  room.list = [...room.byName.values()];
  listeners.forEach((listener) => listener());
}

/** The monsters this room has shown; the same array until one of them changes. */
export function useKnownMonsters(roomId: string): KnownMonster[] {
  return useSyncExternalStore(
    subscribe,
    () => rooms.get(roomId)?.list ?? NONE,
    () => NONE,
  );
}

/** Test seam: forget every room. */
export function resetKnownMonsters(): void {
  rooms.clear();
  listeners.forEach((listener) => listener());
}

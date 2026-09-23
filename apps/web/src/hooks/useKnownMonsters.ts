import { useSyncExternalStore } from 'react';
import type { KnownMonster } from '../utils/monster-mentions.js';

/**
 * Every monster each room's Ring has shown this session, for drawing their sprites wherever
 * narration names them — the Ring feed, the Console and the fight history (roadmap 24).
 *
 * A shared store rather than state inside the Ring pane, because those other panes render
 * the same narration and have no roster of their own. The Ring pane and the fight history
 * record; anyone reads.
 *
 * Accumulated rather than taken from the current roster, because narration outlives the
 * fight: once the ring clears, the lines above still name the monsters that were in it.
 * Keyed by name — the only identifier narration carries — so a later snapshot (a new
 * appearance, a changed icon) replaces the old entry.
 *
 * **Keyed by room.** Room scoping (docs/architecture/rooms-and-identity.md) is a hard rule:
 * one room's monsters must never decorate another room's text, and a reader only ever asks
 * for its own room.
 */
/**
 * What a sighting of a monster must carry — a `ring.state` contestant, or a participant row
 * from the fight history. `owner` is the Beastmaster's name, recorded so the matcher can
 * refuse a name that belongs to a Beastmaster as well as a monster (see `buildMentionIndex`).
 */
export interface MonsterSighting {
  name: string;
  icon: string;
  creatureType: string;
  appearance?: string;
  appearanceHex?: string | null;
  owner?: string | null;
}

/** One room's knowledge. Replaced, never mutated, when anything changes — compared by identity. */
export interface KnownRoom {
  monsters: KnownMonster[];
  beastmasterNames: readonly string[];
}

interface RoomState {
  byName: Map<string, KnownMonster>;
  owners: Set<string>;
  snapshot: KnownRoom;
}

const rooms = new Map<string, RoomState>();
const listeners = new Set<() => void>();
const NONE: KnownRoom = { monsters: [], beastmasterNames: [] };

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function same(a: KnownMonster, b: KnownMonster): boolean {
  return (
    a.icon === b.icon &&
    a.creatureType === b.creatureType &&
    a.appearance === b.appearance &&
    (a.appearanceHex ?? null) === (b.appearanceHex ?? null)
  );
}

/**
 * Records monsters a room has shown. Call it from an effect, not during render: it notifies
 * other components. A no-op when nothing changed, which is almost every `ring.state` tick —
 * an HP change is not a change here.
 *
 * Fed by the Ring pane from `ring.state`, and by the fight history from its participant
 * rows, so a fight history opened on its own (a reload, a direct link, a layout without the
 * Ring) still knows the monsters it is showing.
 */
export function rememberMonsters(roomId: string, sightings: readonly MonsterSighting[]): void {
  let room = rooms.get(roomId);
  let changed = false;
  for (const { name, icon, creatureType, appearance, appearanceHex, owner } of sightings) {
    if (!room) {
      room = { byName: new Map(), owners: new Set(), snapshot: NONE };
      rooms.set(roomId, room);
    }
    if (owner && !room.owners.has(owner)) {
      room.owners.add(owner);
      changed = true;
    }
    if (!name || !icon || !creatureType) continue;
    const next: KnownMonster = { name, icon, creatureType, appearance, appearanceHex: appearanceHex ?? null };
    const known = room.byName.get(name);
    if (known && same(known, next)) continue;
    room.byName.set(name, next);
    changed = true;
  }
  if (!room || !changed) return;
  room.snapshot = { monsters: [...room.byName.values()], beastmasterNames: [...room.owners] };
  listeners.forEach((listener) => listener());
}

/** What this room has shown; the same object until something in it changes. */
export function useKnownMonsters(roomId: string): KnownRoom {
  return useSyncExternalStore(
    subscribe,
    () => rooms.get(roomId)?.snapshot ?? NONE,
    () => NONE,
  );
}

/** Test seam: forget every room. */
export function resetKnownMonsters(): void {
  rooms.clear();
  listeners.forEach((listener) => listener());
}

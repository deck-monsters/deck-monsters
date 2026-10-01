import { beforeEach, describe, expect, it } from 'vitest';

import {
  MECHANIC_NOTES,
  mechanicKeyOf,
  mechanicNoteFor,
  mechanicPayloadOf,
  resetMechanicClaimsForTests,
} from '../lib/mechanic-notes.js';
import { RING_EVENTS } from '../../../../packages/engine/src/ring/ring-events.js';

const ringEvent = (id: string) => ({ ringEvent: { id, name: id } });

describe('mechanic notes (roadmap 39 C4)', () => {
  beforeEach(() => {
    localStorage.clear();
    resetMechanicClaimsForTests();
  });

  it('every ring event has a note, so a new event fails until it gets one', () => {
    for (const event of RING_EVENTS) {
      expect(MECHANIC_NOTES[`ring-event:${event.id}`], event.id).toBeTruthy();
    }
  });

  it('a tagged line shows its note once; the same row keeps it on re-render', () => {
    const first = mechanicNoteFor('u1', 'ring', 'e1', { mechanic: 'ambush' });
    expect(first).toBe(MECHANIC_NOTES.ambush);
    expect(mechanicNoteFor('u1', 'ring', 'e1', { mechanic: 'ambush' })).toBe(first);
  });

  it('a second line with the same key shows no note', () => {
    mechanicNoteFor('u1', 'ring', 'e1', { mechanic: 'ambush' });
    expect(mechanicNoteFor('u1', 'ring', 'e2', { mechanic: 'ambush' })).toBeUndefined();
  });

  it('a different key shows its own note', () => {
    mechanicNoteFor('u1', 'ring', 'e1', { mechanic: 'ambush' });
    expect(mechanicNoteFor('u1', 'ring', 'e2', ringEvent('gauntlet'))).toBe(
      MECHANIC_NOTES['ring-event:gauntlet'],
    );
  });

  it('the Console does not repeat a note the Ring showed', () => {
    mechanicNoteFor('u1', 'ring', 'e1', { mechanic: 'boss-rivals' });
    expect(mechanicNoteFor('u1', 'console', 'e1', { mechanic: 'boss-rivals' })).toBeUndefined();
  });

  it('shows none after a reload (fresh claims, stored state)', () => {
    mechanicNoteFor('u1', 'ring', 'e1', { mechanic: 'ambush' });
    resetMechanicClaimsForTests();
    expect(mechanicNoteFor('u1', 'ring', 'e1', { mechanic: 'ambush' })).toBeUndefined();
  });

  it('is per player', () => {
    mechanicNoteFor('u1', 'ring', 'e1', { mechanic: 'ambush' });
    expect(mechanicNoteFor('u2', 'ring', 'e1', { mechanic: 'ambush' })).toBe(MECHANIC_NOTES.ambush);
  });

  it('shows no note for an untagged line, an unknown ring event, or an unknown tag', () => {
    expect(mechanicNoteFor('u1', 'ring', 'e1', {})).toBeUndefined();
    expect(mechanicNoteFor('u1', 'ring', 'e2', ringEvent('not-an-event'))).toBeUndefined();
    expect(mechanicNoteFor('u1', 'ring', 'e3', { mechanic: 'nope' })).toBeUndefined();
    expect(mechanicNoteFor('u1', 'ring', 'e4', undefined)).toBeUndefined();
  });

  it('still limits a session to one note when storage throws', () => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new Error('blocked');
    };
    try {
      expect(mechanicNoteFor('u1', 'ring', 'e1', { mechanic: 'ambush' })).toBe(MECHANIC_NOTES.ambush);
      expect(mechanicNoteFor('u1', 'ring', 'e2', { mechanic: 'ambush' })).toBeUndefined();
    } finally {
      Storage.prototype.setItem = original;
    }
  });

  it('reads the key from the payload, not the prose', () => {
    expect(mechanicKeyOf(ringEvent('house-war'))).toBe('ring-event:house-war');
    expect(mechanicKeyOf({ mechanic: 'boss-temperament' })).toBe('boss-temperament');
    expect(mechanicPayloadOf({ contestant: {}, mechanic: 'ambush' })).toEqual({ mechanic: 'ambush' });
    expect(mechanicPayloadOf(ringEvent('gauntlet'))).toEqual({ ringEvent: { id: 'gauntlet' } });
    expect(mechanicPayloadOf({ damage: 3 })).toBeUndefined();
  });
});

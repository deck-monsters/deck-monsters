import { describe, expect, it } from 'vitest';

import type { GameEvent } from '@deck-monsters/server/types';
import { shouldRenderRingEvent } from './ring-feed-events.js';

function event(type: GameEvent['type'], scope: GameEvent['scope'] = 'public'): GameEvent {
  return {
    id: `evt-${type}`,
    roomId: 'room-1',
    timestamp: Date.now(),
    type,
    scope,
    text: type,
    payload: {},
  };
}

describe('shouldRenderRingEvent', () => {
  it('hides ring.fightResolved system analytics event', () => {
    expect(shouldRenderRingEvent(event('ring.fightResolved'))).to.equal(false);
  });

  it('keeps player-facing ring narration events', () => {
    expect(shouldRenderRingEvent(event('ring.add'))).to.equal(true);
    expect(shouldRenderRingEvent(event('ring.fight'))).to.equal(true);
    expect(shouldRenderRingEvent(event('ring.xp'))).to.equal(true);
  });
});

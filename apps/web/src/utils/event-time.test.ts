import { describe, expect, it } from 'vitest';

import { getKeyRingEventMeta } from './event-time.js';

describe('getKeyRingEventMeta', () => {
  it('returns Joined for ring.add', () => {
    expect(
      getKeyRingEventMeta({
        id: '1',
        roomId: 'r',
        timestamp: 0,
        type: 'ring.add',
        scope: 'public',
        text: '',
        payload: {},
      })
    ).to.deep.equal({ label: 'Joined' });
  });

  it('returns Fight began vs Fight ended for ring.fight', () => {
    expect(
      getKeyRingEventMeta({
        id: '1',
        roomId: 'r',
        timestamp: 0,
        type: 'ring.fight',
        scope: 'public',
        text: '',
        payload: { contestants: [] },
      })
    ).to.deep.equal({ label: 'Fight began' });

    expect(
      getKeyRingEventMeta({
        id: '2',
        roomId: 'r',
        timestamp: 0,
        type: 'ring.fight',
        scope: 'public',
        text: '',
        payload: { eventName: 'fightConcludes' },
      })
    ).to.deep.equal({ label: 'Fight ended' });
  });
});

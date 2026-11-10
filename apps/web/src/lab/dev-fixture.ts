/**
 * A tiny hand-made fixture (about 30 events of mixed heights) so the lab works with no
 * recorded fixture present. Real fixtures live in `./fixtures/*.json` and are loaded by name.
 * Event shapes follow the engine's: `payload.lines` blocks (a card frame, a roll, a hit),
 * and plain `text` rows for events without lines.
 */
import type { GameEvent } from '@deck-monsters/server/types';
import type { LabFixture } from './lab-transport.js';

export const LAB_ROOM_ID = '00000000-0000-4000-8000-0000000001ab';
export const LAB_VIEWER_ID = '00000000-0000-4000-8000-0000000000aa';

const BASE = 1_700_000_000_000;

function pub(
  at: number,
  suffix: string,
  type: GameEvent['type'],
  text: string,
  payload: Record<string, unknown> = {}
) {
  const id = `${BASE + at}-${suffix}`;
  const data: GameEvent = {
    id,
    roomId: LAB_ROOM_ID,
    timestamp: BASE + at,
    type,
    scope: 'public',
    text,
    payload,
  };
  return { id, atMs: at, data };
}

export function devFixture(): LabFixture {
  const events: LabFixture['events'] = [];
  let t = 0;
  let n = 0;
  const next = (gap: number) => {
    t += gap;
    n += 1;
    return `d${String(n).padStart(3, '0')}`;
  };

  events.push(
    pub(t, next(0), 'ring.add', 'Poirot enters the ring.', {
      lines: [
        {
          kind: 'arrival',
          text: '🐍 Poirot, a Basilisk, enters the ring.',
          name: 'Poirot',
          boss: false,
        },
      ],
    })
  );
  events.push(
    pub(t + 800, next(800), 'ring.add', 'Quoloth enters the ring.', {
      lines: [
        {
          kind: 'arrival',
          text: '🐉 Quoloth, a Gladiator, enters the ring.',
          name: 'Quoloth',
          boss: false,
        },
      ],
    })
  );
  events.push(pub(t + 600, next(600), 'announce', 'The crowd murmurs. A fight begins in a moment.'));

  for (let round = 1; round <= 6; round++) {
    events.push(
      pub(t + 900, next(900), 'ring.fight', `Round ${round}`, {
        lines: [
          { kind: 'round', text: `Round ${round}`, round },
          {
            kind: 'standing',
            text: `🐍 Poirot is at ${34 - round * 3}/34 hp.`,
            name: 'Poirot',
            hp: 34 - round * 3,
            maxHp: 34,
          },
          {
            kind: 'standing',
            text: `🐉 Quoloth is at ${30 - round * 2}/30 hp.`,
            name: 'Quoloth',
            hp: 30 - round * 2,
            maxHp: 30,
          },
        ],
      })
    );
    events.push(
      pub(t + 700, next(700), 'card.played', `Poirot plays Hit.`, {
        lines: [
          { kind: 'play', text: '🐍 Poirot plays Hit.', actor: 'Poirot', card: 'Hit' },
          {
            kind: 'card',
            title: 'Hit  •',
            text: 'Hit  •\nA straightforward attack.\nDamage: 1d6\nAttack: 1d20 + STR vs AC',
            description: 'A straightforward attack, swung with the whole body behind it.',
            stats: [
              { label: 'Damage', value: '1d6' },
              { label: 'Attack', value: '1d20 + STR vs AC' },
            ],
          },
          {
            kind: 'roll',
            text: '🎲 Poirot rolls 1d20 + 2 = 17 vs AC 12',
            who: 'Poirot',
            die: '1d20',
            natural: 15,
            bonus: 2,
            total: 17,
            vs: 12,
            result: 'success',
          },
          { kind: 'outcome', text: 'Hit!' },
          {
            kind: 'hit',
            text: '🐍 Poirot hits 🐉 Quoloth for 4 damage.',
            assailant: 'Poirot',
            target: 'Quoloth',
            damage: 4,
          },
        ],
      })
    );
    if (round % 2 === 0) {
      events.push(
        pub(
          t + 500,
          next(500),
          'card.played',
          'Quoloth swings wildly and misses; the long, slow arc of the blade carries it past Poirot and into the sand, where it throws up a plume of dust that the crowd cheers.',
          {
            lines: [
              {
                kind: 'miss',
                text: 'Quoloth swings wildly and misses; the long, slow arc of the blade carries it past Poirot and into the sand, where it throws up a plume of dust that the crowd cheers.',
                assailant: 'Quoloth',
                target: 'Poirot',
                blocked: false,
              },
            ],
          }
        )
      );
    }
  }
  events.push(
    pub(t + 800, next(800), 'ring.win', 'Poirot wins.', {
      lines: [
        { kind: 'win', text: '🏆 Poirot wins!', winners: ['Poirot'] },
        { kind: 'fight-end', text: 'The fight lasted 6 rounds.', deaths: 1, rounds: 6, isDraw: false },
      ],
    })
  );
  events.push(
    pub(t + 400, next(400), 'ring.xp', 'Poirot gains 40 XP.', {
      lines: [{ kind: 'xp', text: 'Poirot gains 40 XP.', name: 'Poirot', xp: 40 }],
    })
  );
  events.push(
    pub(t + 400, next(400), 'ring.clear', 'The ring is clear.', {
      lines: [{ kind: 'system', text: 'The ring is clear.' }],
    })
  );
  events.push({
    id: `${BASE + t + 300}-d-ringstate`,
    atMs: t + 300,
    data: {
      id: `${BASE + t + 300}-d-ringstate`,
      roomId: LAB_ROOM_ID,
      timestamp: BASE + t + 300,
      type: 'ring.state',
      scope: 'public',
      text: '',
      payload: {
        nextFightAt: BASE + t + 120_000,
        nextBossSpawnAt: null,
        nextMegaBossAt: null,
        monsterCount: 0,
        inEncounter: false,
        contestants: [],
      },
    },
  });

  // A few private console rows for the viewer, so the Console has something to show.
  const consoleRow = (at: number, suffix: string, text: string, payload: Record<string, unknown> = {}) => {
    const id = `${BASE + at}-${suffix}`;
    return {
      id,
      atMs: at,
      data: {
        id,
        roomId: LAB_ROOM_ID,
        timestamp: BASE + at,
        type: 'announce' as const,
        scope: 'private' as const,
        targetUserId: LAB_VIEWER_ID,
        text,
        payload,
      } satisfies GameEvent,
    };
  };
  events.push(consoleRow(100, 'c001', 'Welcome to the feed lab.'));
  events.push(consoleRow(2500, 'c002', 'Your monster Labmon is resting.'));

  events.sort((a, b) => a.atMs - b.atMs);
  return {
    name: 'dev',
    description: 'Hand-made synthetic events for developing the lab.',
    viewerUserId: LAB_VIEWER_ID,
    roomId: LAB_ROOM_ID,
    events,
  };
}

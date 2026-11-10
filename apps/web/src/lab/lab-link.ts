/**
 * The feed lab's terminating tRPC link. It answers every operation the mounted room UI makes
 * from a `LabTransport` and a table of canned query results, and never touches the network.
 *
 * Output shapes are checked against the real router (`RouterOutputs`) wherever the server
 * procedure's type is expressible, so a server-side shape change fails the typecheck here
 * instead of silently feeding the lab a stale shape.
 *
 * Anything without a handler logs `[lab] unhandled <type> <path>` and resolves `null`
 * (queries) or `{ ok: true }` (mutations).
 */
import { TRPCClientError, type TRPCLink } from '@trpc/client';
import type { inferRouterOutputs } from '@trpc/server';
import { observable } from '@trpc/server/observable';
import type { AppRouter } from '@deck-monsters/server/types';
import type { LabTransport } from './lab-transport.js';

type Out = inferRouterOutputs<AppRouter>;

type OpType = 'query' | 'mutation' | 'subscription';

interface HandlerContext {
  transport: LabTransport;
  input: unknown;
}

type Handler = (ctx: HandlerContext) => unknown;

export const LAB_VIEWER_NAME = 'Lab Viewer';
export const LAB_MONSTER_NAME = 'Labmon';

function asRecord(input: unknown): Record<string, unknown> {
  return typeof input === 'object' && input !== null ? (input as Record<string, unknown>) : {};
}

function inventory(): Out['game']['myInventory'] {
  return {
    hasCharacter: true,
    monsterSlots: 3,
    monsters: [
      {
        name: LAB_MONSTER_NAME,
        type: 'Basilisk',
        level: 1,
        xpIntoLevel: 0,
        xpNeededForLevel: 100,
        dead: false,
        inRing: false,
        inEncounter: false,
        cardSlots: 5,
        cards: [],
        presets: {},
        hp: 20,
        maxHp: 20,
        revivesAt: null,
        battles: { wins: 0, losses: 0, total: 0 },
        monsterClass: 'Fighter',
        nextCards: null,
        nextLevel: { level: 2, hp: 2, ac: 0, str: 0, dex: 0, int: 0 },
        pronoun: 'they',
        icon: '🐍',
        appearance: 'green and gold',
      },
    ],
    unequippedDeck: [],
    cardCosts: {},
    cardCompatibility: {},
    items: { character: [], monsters: [] },
  };
}

/** Query handlers keyed by tRPC path. */
const QUERIES: Record<string, Handler> = {
  'game.ringHistory': ({ transport }) => transport.ringHistory() satisfies Out['game']['ringHistory'],
  'game.consoleHistory': ({ transport }) =>
    transport.consoleHistory() satisfies Out['game']['consoleHistory'],
  'game.ringState': ({ transport }) =>
    ({
      ...transport.ringStateSnapshot(),
      bossSummonsRemaining: 3,
      bossSummonLimit: 3,
      bossSummonResetAt: null,
    }) as unknown as Out['game']['ringState'],
  'game.recentFights': () => [] satisfies Out['game']['recentFights'],
  'game.pendingPrompt': () => null satisfies Out['game']['pendingPrompt'],
  'game.flowStatus': () =>
    ({
      consoleActive: false,
      workshopActive: false,
      pendingPrompt: null,
    }) satisfies Out['game']['flowStatus'],
  'game.myInventory': () => inventory(),
  'game.myMonsters': () =>
    [
      { name: LAB_MONSTER_NAME, dead: false, inRing: false, battlesTotal: 0 },
    ] satisfies Out['game']['myMonsters'],
  'game.catchUp': () =>
    ({ fightCount: 0, summaries: [], textSummary: '' }) satisfies Out['game']['catchUp'],
  'room.info': ({ transport, input }) =>
    ({
      roomId: (asRecord(input)['roomId'] as string | undefined) ?? transport.fixture.roomId,
      name: 'Feed lab',
      inviteCode: 'LAB000',
      memberCount: 1,
      role: 'member',
      lastSeenAt: null,
    }) satisfies Out['room']['info'],
  'room.list': ({ transport }) =>
    [
      { roomId: transport.fixture.roomId, name: 'Feed lab', role: 'member' },
    ] satisfies Out['room']['list'],
  'room.members': () => [] as unknown,
  'profile.me': () => ({ displayName: LAB_VIEWER_NAME }) satisfies Out['profile']['me'],
  'chat.history': () =>
    ({ messages: [], lastReadId: 0, unread: 0 }) satisfies Out['chat']['history'],
  'chat.members': () => [] satisfies Out['chat']['members'],
  'chat.dmNames': () => [] satisfies Out['chat']['dmNames'],
  // Workshop and Leaders surfaces (mounted only when their tab is opened): empty but well-shaped.
  'game.cardFacts': () => [] as unknown as Out['game']['cardFacts'],
  'game.spawnOptions': () => ({ types: [], pronouns: [] }) satisfies Out['game']['spawnOptions'],
  'game.characterCreationChoices': () =>
    ({
      pronouns: [],
      avatars: [],
      suggestedName: LAB_VIEWER_NAME,
    }) as unknown as Out['game']['characterCreationChoices'],
  'game.shop': () =>
    ({
      name: 'Lab Emporium',
      adjective: 'quiet',
      closingTime: new Date(Date.now() + 3_600_000).toISOString(),
      coins: 0,
      items: [],
      cards: [],
      backRoom: [],
      sellOffset: 0.5,
    }) satisfies Out['game']['shop'],
  'leaderboard.roomPlayers': () => [],
  'leaderboard.roomMonsters': () => [],
  'leaderboard.globalPlayers': () => [],
  'leaderboard.globalMonsters': () => [],
  'chat.unread': () => ({ unread: 0, lastReadId: 0 }) satisfies Out['chat']['unread'],
};

const MUTATIONS: Record<string, Handler> = {
  /*
   * The server publishes a private `system` event with `consoleInput: true` BEFORE it decides
   * whether the command is recognised, and answers `{ ok: true }` while the flow runs on in
   * the background. The lab has no engine, so the echo is the whole answer.
   */
  'game.command': ({ transport, input }) => {
    const { command } = asRecord(input);
    const text = typeof command === 'string' ? command : '';
    transport.publishSynthetic({
      type: 'system',
      scope: 'private',
      targetUserId: transport.fixture.viewerUserId,
      text,
      payload: { consoleInput: true, causedByCommandId: `lab-${Date.now()}` },
    });
    return { ok: true };
  },
  'chat.markRead': ({ input }) => ({
    lastReadId: Number(asRecord(input)['lastReadId'] ?? 0),
    unread: 0,
  }),
};

export function createLabLink(transport: LabTransport): TRPCLink<AppRouter> {
  return () =>
    ({ op }) =>
      observable((observer) => {
        const type = op.type as OpType;

        if (type === 'subscription') {
          if (op.path !== 'game.ringFeed') {
            console.warn(`[lab] unhandled ${type} ${op.path}`);
            observer.next({ result: { type: 'started' } } as never);
            return () => {};
          }
          observer.next({ result: { type: 'started' } } as never);
          const input = asRecord(op.input);
          const unsubscribe = transport.subscribe(
            {
              ...(typeof input['lastEventId'] === 'string' ? { lastEventId: input['lastEventId'] } : {}),
            },
            {
              // Tracked frames reach `onData` as `{ id, data }`, which is what
              // `result.data` carries for a tracked yield.
              next: (frame) => observer.next({ result: { id: frame.id, data: frame } } as never),
              error: (err) => observer.error(TRPCClientError.from(err)),
            }
          );
          return unsubscribe;
        }

        const table = type === 'query' ? QUERIES : MUTATIONS;
        const handler = table[op.path];
        let answered = false;
        const timer = setTimeout(
          () => {
            answered = true;
            let value: unknown;
            if (handler) {
              try {
                value = handler({ transport, input: op.input });
              } catch (err) {
                observer.error(TRPCClientError.from(err instanceof Error ? err : new Error(String(err))));
                return;
              }
            } else {
              console.warn(`[lab] unhandled ${type} ${op.path}`);
              value = type === 'query' ? null : { ok: true };
            }
            observer.next({ result: { type: 'data', data: value } } as never);
            observer.complete();
          },
          Math.max(0, transport.latency())
        );
        return () => {
          if (!answered) clearTimeout(timer);
        };
      });
}

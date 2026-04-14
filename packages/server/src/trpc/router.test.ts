import { expect } from 'chai';
import { TRPCError } from '@trpc/server';

import { createRouter } from './router.js';

const ROOM_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const USER_ID = '11111111-2222-3333-4444-555555555555';

describe('trpc/router respondToPrompt', () => {
	it('forwards a valid prompt response', async () => {
		const roomManager = {
			assertMember: async () => undefined,
			getEventBus: async () => ({
				respondToPrompt: () => true,
				getPendingPromptForUser: () => null,
			}),
		} as unknown as Parameters<typeof createRouter>[0];

		const router = createRouter(roomManager);
		const caller = router.createCaller({ userId: USER_ID, serviceTokenValid: false });

		const result = await caller.game.respondToPrompt({
			roomId: ROOM_ID,
			requestId: 'req-1',
			answer: '0',
		});

		expect(result).to.deep.equal({ ok: true });
	});

	it('throws PRECONDITION_FAILED when requestId is stale', async () => {
		const roomManager = {
			assertMember: async () => undefined,
			getEventBus: async () => ({
				respondToPrompt: () => false,
				getPendingPromptForUser: () => ({ requestId: 'req-2', question: 'Q', choices: ['0'], timeoutSeconds: 120 }),
			}),
		} as unknown as Parameters<typeof createRouter>[0];

		const router = createRouter(roomManager);
		const caller = router.createCaller({ userId: USER_ID, serviceTokenValid: false });

		const err = await caller.game.respondToPrompt({
			roomId: ROOM_ID,
			requestId: 'req-1',
			answer: '0',
		}).catch((e: unknown) => e);

		expect(err).to.be.instanceOf(TRPCError);
		expect((err as TRPCError).code).to.equal('PRECONDITION_FAILED');
	});
});

describe('trpc/router card management procedures', () => {
	it('returns inventory summary for game.myInventory', async () => {
		const targetMonster = {
			givenName: 'Stonefang',
			creatureType: 'Basilisk',
			level: 4,
			inEncounter: false,
			cardSlots: 9,
			cards: [{ cardType: 'Hit' }],
			items: [{ itemType: 'Potion' }],
			options: { presets: { aggro: ['Hit'] } },
		};
		const game = {
			characters: {
				[USER_ID]: {
					monsters: [targetMonster],
					deck: [{ cardType: 'Blink' }],
					items: [{ itemType: 'Scroll' }],
				},
			},
			ring: { contestants: [{ userId: USER_ID, isBoss: false, monster: targetMonster }] },
		};
		const roomManager = {
			assertMember: async () => undefined,
			getGame: async () => game,
		} as unknown as Parameters<typeof createRouter>[0];

		const router = createRouter(roomManager);
		const caller = router.createCaller({ userId: USER_ID, serviceTokenValid: false });
		const result = await caller.game.myInventory({ roomId: ROOM_ID });

		expect(result.monsters).to.have.length(1);
		expect(result.monsters[0]).to.include({
			name: 'Stonefang',
			type: 'Basilisk',
			inRing: true,
		});
		expect(result.unequippedDeck).to.deep.equal(['Blink']);
		expect(result.items.character).to.deep.equal(['Scroll']);
	});

	it('runs game.unequipCard via serialized engine work', async () => {
		const unequipCard = async () => ({ removedCount: 1, monsterName: 'Stonefang' });
		const publish = () => undefined;
		const roomManager = {
			assertMember: async () => undefined,
			getGame: async () => ({
				characters: { [USER_ID]: { unequipCard } },
			}),
			getEventBus: async () => ({ publish }),
			runSerializedEngineWork: async (_roomId: string, fn: () => Promise<unknown>) => fn(),
		} as unknown as Parameters<typeof createRouter>[0];

		const router = createRouter(roomManager);
		const caller = router.createCaller({ userId: USER_ID, serviceTokenValid: false });
		const result = await caller.game.unequipCard({
			roomId: ROOM_ID,
			monsterName: 'Stonefang',
			cardName: 'Hit',
		});

		expect(result).to.deep.equal({ removedCount: 1, monsterName: 'Stonefang' });
	});

	it('returns transformed loadPreset result', async () => {
		const loadPreset = async () => ({
			equipped: 2,
			requested: 3,
			skippedCards: ['Heal'],
			presetName: 'aggro',
			monsterName: 'Stonefang',
		});
		const roomManager = {
			assertMember: async () => undefined,
			getGame: async () => ({
				characters: { [USER_ID]: { loadPreset } },
			}),
			getEventBus: async () => ({ publish: () => undefined }),
			runSerializedEngineWork: async (_roomId: string, fn: () => Promise<unknown>) => fn(),
		} as unknown as Parameters<typeof createRouter>[0];

		const router = createRouter(roomManager);
		const caller = router.createCaller({ userId: USER_ID, serviceTokenValid: false });
		const result = await caller.game.loadPreset({
			roomId: ROOM_ID,
			monsterName: 'Stonefang',
			presetName: 'aggro',
		});

		expect(result).to.deep.equal({
			equippedCount: 2,
			requestedCount: 3,
			skippedCards: ['Heal'],
		});
	});

	it('routes game.equipCards through character.equipCards and returns summary', async () => {
		let receivedInput: Record<string, unknown> | null = null;
		const equipCards = async (input: Record<string, unknown>) => {
			receivedInput = input;
			return {
				equipped: 1,
				requested: 2,
				skippedCards: ['Heal'],
				monsterName: 'Stonefang',
			};
		};

		const roomManager = {
			assertMember: async () => undefined,
			getGame: async () => ({
				characters: { [USER_ID]: { equipCards } },
			}),
			getEventBus: async () => ({ publish: () => undefined }),
			runSerializedEngineWork: async (_roomId: string, fn: () => Promise<unknown>) => fn(),
		} as unknown as Parameters<typeof createRouter>[0];

		const router = createRouter(roomManager);
		const caller = router.createCaller({ userId: USER_ID, serviceTokenValid: false });
		const result = await caller.game.equipCards({
			roomId: ROOM_ID,
			monsterName: 'Stonefang',
			cardNames: ['Hit', 'Heal'],
		});

		expect(receivedInput).to.not.equal(null);
		expect(receivedInput?.monsterName).to.equal('Stonefang');
		expect(receivedInput?.cardNames).to.deep.equal(['Hit', 'Heal']);
		expect(receivedInput?.replaceAll).to.equal(false);
		expect(result).to.deep.equal({
			equippedCount: 1,
			requestedCount: 2,
			skippedCards: ['Heal'],
		});
	});
});

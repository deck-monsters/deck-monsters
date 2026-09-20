import { expect } from 'chai';
import { TRPCError } from '@trpc/server';
import { Game } from '@deck-monsters/engine';

import { createRouter, activeFlows, activePromptFreeMutations } from './router.js';

const ROOM_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const USER_ID = '11111111-2222-3333-4444-555555555555';
const OTHER_USER_ID = '22222222-3333-4444-5555-666666666666';

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
			items: [{ itemType: 'Potion', expired: false, stats: 'Usable 1 time.' }],
			options: { presets: { aggro: ['Hit'] } },
			canHoldCard: (card: { cardType?: string }) => card.cardType !== 'Blink',
			canUseItem: (item: { itemType?: string }) => item.itemType !== 'Scroll',
			hp: 22,
			maxHp: 40,
			battles: { wins: 3, losses: 1, total: 4 },
		};
		const supportMonster = {
			givenName: 'Mirebell',
			creatureType: 'Jinn',
			level: 2,
			inEncounter: false,
			cardSlots: 9,
			cards: [],
			items: [],
			options: { presets: {} },
			canHoldCard: (card: { cardType?: string }) => card.cardType === 'Blink',
			canUseItem: (item: { itemType?: string }) => item.itemType !== 'Scroll',
			hp: 15,
			maxHp: 15,
			battles: { wins: 0, losses: 0, total: 0 },
		};
		const game = {
			characters: {
				[USER_ID]: {
					monsters: [targetMonster, supportMonster],
					deck: [{ cardType: 'Blink' }],
					items: [{ itemType: 'Scroll', expired: false, stats: 'Usable an unlimited number of times.' }],
					canUseItem: () => false,
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

		expect(result.hasCharacter).to.equal(true);
		expect(result.monsters).to.have.length(2);
		expect(result.monsters[0]).to.include({
			name: 'Stonefang',
			type: 'Basilisk',
			inRing: true,
			hp: 22,
			maxHp: 40,
			revivesAt: null,
		});
		expect(result.monsters[0]!.battles).to.deep.equal({ wins: 3, losses: 1, total: 4 });
		expect(result.unequippedDeck).to.deep.equal(['Blink']);
		expect(result.cardCompatibility).to.deep.equal({
			Blink: ['Mirebell'],
		});
		expect(result.items.character).to.deep.equal([
			{
				displayName: 'Scroll',
				expired: false,
				stats: 'Usable an unlimited number of times.',
				// Neither monster's canUseItem accepts a Scroll, and the character's own
				// canUseItem always returns false in this fixture.
				usableOnMonsters: [],
				usableOnCharacter: false,
				requiresPrompt: false,
			},
		]);
		expect(result.items.monsters).to.deep.equal([
			{
				monsterName: 'Stonefang',
				items: [
					{
						displayName: 'Potion',
						expired: false,
						stats: 'Usable 1 time.',
						usableOnMonsters: ['Stonefang', 'Mirebell'],
						usableOnCharacter: false,
						requiresPrompt: false,
					},
				],
			},
			{ monsterName: 'Mirebell', items: [] },
		]);
	});

	it('computes revivesAt from respawnTimeoutBegan + respawnTimeoutLength for a fallen monster mid-revival', async () => {
		const fallenMonster = {
			givenName: 'Ashfall',
			creatureType: 'Minotaur',
			level: 3,
			dead: true,
			inEncounter: false,
			cardSlots: 9,
			cards: [],
			items: [],
			options: {},
			hp: 0,
			maxHp: 30,
			respawnTimeoutBegan: 1_000,
			respawnTimeoutLength: 5_000,
			battles: { wins: 2, losses: 5, total: 7 },
		};
		const game = {
			characters: { [USER_ID]: { monsters: [fallenMonster], deck: [], items: [] } },
			ring: { contestants: [] },
		};
		const roomManager = {
			assertMember: async () => undefined,
			getGame: async () => game,
		} as unknown as Parameters<typeof createRouter>[0];

		const caller = createRouter(roomManager).createCaller({ userId: USER_ID, serviceTokenValid: false });
		const result = await caller.game.myInventory({ roomId: ROOM_ID });

		expect(result.monsters[0]).to.include({ dead: true, hp: 0, maxHp: 30, revivesAt: 6_000 });
	});

	it('reports revivesAt as null for a fallen monster with no revival timer running', async () => {
		// A monster can be dead with no active timer — e.g. a permadeath, or the process
		// restarted and the in-memory timer/length fields were never rehydrated (they are
		// declared instance fields, not persisted options — see docs/room-scoping.md's
		// sibling doc on serialization, and creatures/health.ts's `respawn`). The workshop
		// must not show a stale or fabricated countdown in that case.
		const fallenMonster = {
			givenName: 'Ashfall',
			creatureType: 'Minotaur',
			level: 3,
			dead: true,
			inEncounter: false,
			cardSlots: 9,
			cards: [],
			items: [],
			options: {},
			hp: 0,
			maxHp: 30,
		};
		const game = {
			characters: { [USER_ID]: { monsters: [fallenMonster], deck: [], items: [] } },
			ring: { contestants: [] },
		};
		const roomManager = {
			assertMember: async () => undefined,
			getGame: async () => game,
		} as unknown as Parameters<typeof createRouter>[0];

		const caller = createRouter(roomManager).createCaller({ userId: USER_ID, serviceTokenValid: false });
		const result = await caller.game.myInventory({ roomId: ROOM_ID });

		expect(result.monsters[0]).to.include({ revivesAt: null });
	});

	it('clamps a negative hp to 0 for display and falls back to sane defaults when hp/maxHp/battles are missing (test doubles, legacy snapshots)', async () => {
		const bareMonster = {
			givenName: 'Stonefang',
			creatureType: 'Basilisk',
			level: 1,
			inEncounter: false,
			cardSlots: 9,
			cards: [],
			items: [],
			options: {},
			hp: -12,
		};
		const game = {
			characters: { [USER_ID]: { monsters: [bareMonster], deck: [], items: [] } },
			ring: { contestants: [] },
		};
		const roomManager = {
			assertMember: async () => undefined,
			getGame: async () => game,
		} as unknown as Parameters<typeof createRouter>[0];

		const caller = createRouter(roomManager).createCaller({ userId: USER_ID, serviceTokenValid: false });
		const result = await caller.game.myInventory({ roomId: ROOM_ID });

		expect(result.monsters[0]).to.include({ hp: 0, maxHp: 1 });
		expect(result.monsters[0]!.battles).to.deep.equal({ wins: 0, losses: 0, total: 0 });
	});

	it('degrades gracefully when an item is missing canUseItem/expired (test doubles, legacy snapshots)', async () => {
		const bareMonster = {
			givenName: 'Stonefang',
			creatureType: 'Basilisk',
			level: 1,
			inEncounter: false,
			cardSlots: 9,
			cards: [],
			items: [],
			options: {},
			// No canHoldCard, no canUseItem — matches the "legacy snapshot" case
			// `canMonsterHoldCard` already defends against.
		};
		const game = {
			characters: {
				[USER_ID]: {
					monsters: [bareMonster],
					deck: [],
					// A bare item object with neither `canUseItem`'s caller side (n/a here) nor
					// `expired`/`stats` getters.
					items: [{ itemType: 'MysteryScroll' }],
					// No canUseItem on the character either.
				},
			},
			ring: { contestants: [] },
		};
		const roomManager = {
			assertMember: async () => undefined,
			getGame: async () => game,
		} as unknown as Parameters<typeof createRouter>[0];

		const router = createRouter(roomManager);
		const caller = router.createCaller({ userId: USER_ID, serviceTokenValid: false });
		const result = await caller.game.myInventory({ roomId: ROOM_ID });

		expect(result.items.character).to.deep.equal([
			{
				displayName: 'MysteryScroll',
				expired: false,
				stats: 'Usable an unlimited number of times.',
				usableOnMonsters: [],
				usableOnCharacter: false,
				requiresPrompt: false,
			},
		]);
	});

	it('returns an empty items summary when a monster/character canUseItem throws', async () => {
		const throwingMonster = {
			givenName: 'Stonefang',
			creatureType: 'Basilisk',
			level: 1,
			inEncounter: false,
			cardSlots: 9,
			cards: [],
			items: [],
			options: {},
			canUseItem: () => {
				throw new Error('boom');
			},
		};
		const game = {
			characters: {
				[USER_ID]: {
					monsters: [throwingMonster],
					deck: [],
					items: [{ itemType: 'Scroll', expired: true }],
					canUseItem: () => {
						throw new Error('boom');
					},
				},
			},
			ring: { contestants: [] },
		};
		const roomManager = {
			assertMember: async () => undefined,
			getGame: async () => game,
		} as unknown as Parameters<typeof createRouter>[0];

		const router = createRouter(roomManager);
		const caller = router.createCaller({ userId: USER_ID, serviceTokenValid: false });
		const result = await caller.game.myInventory({ roomId: ROOM_ID });

		expect(result.items.character).to.deep.equal([
			{
				displayName: 'Scroll',
				expired: true,
				stats: 'All used up!',
				usableOnMonsters: [],
				usableOnCharacter: false,
				requiresPrompt: false,
			},
		]);
	});

	it('returns a room-scoped shop with prices, ownership and affordability', async () => {
		const potion = { itemType: 'Potion', cost: 50, description: 'Heals.', stats: 'Usable 1 time.' };
		const game = {
			characters: { [USER_ID]: { coins: 75, items: [potion] } },
			shop: {
				name: 'Moon Market', adjective: 'moss-covered', closingTime: new Date('2030-01-01T00:00:00Z'),
				priceOffset: 0.8, backRoomOffset: 5, items: [potion], backRoom: [], cards: [], pronouns: {},
			},
		};
		const roomManager = {
			assertMember: async () => undefined,
			getGame: async () => game,
		} as unknown as Parameters<typeof createRouter>[0];

		(roomManager as any).runSerializedEngineWork = async (_lane: string, fn: () => Promise<unknown>) => fn();
		const caller = createRouter(roomManager).createCaller({ userId: USER_ID, serviceTokenValid: false });
		const result = await caller.game.shop({ roomId: ROOM_ID });

		expect(result.coins).to.equal(75);
		expect(result.items[0]).to.deep.include({
			stockIndex: 0, stockCount: 1, section: 'items', displayName: 'Potion', price: 80,
			affordable: false, ownedCount: 1, description: 'Heals.',
		});
	});

	it('deduplicates equivalent shop stock and reports the number available', async () => {
		const potion = { itemType: 'Potion', cost: 50, description: 'Heals.' };
		const game = {
			characters: { [USER_ID]: { coins: 500, items: [] } },
			shop: {
				name: 'Moon Market', adjective: 'quiet', closingTime: new Date('2030-01-01T00:00:00Z'),
				priceOffset: 1, backRoomOffset: 5, items: [potion, { ...potion }], backRoom: [], cards: [],
			},
		};
		const roomManager = { assertMember: async () => undefined, getGame: async () => game } as any;
		roomManager.runSerializedEngineWork = async (_lane: string, fn: () => Promise<unknown>) => fn();
		const result = await createRouter(roomManager).createCaller({ userId: USER_ID, serviceTokenValid: false })
			.game.shop({ roomId: ROOM_ID });

		expect(result.items).to.have.lengthOf(1);
		expect(result.items[0]).to.deep.include({ stockIndex: 0, stockCount: 2, displayName: 'Potion' });
	});

	it('buys from the current room shop through the serialized mutation lane', async () => {
		const potion = { itemType: 'Potion', cost: 50 };
		const ownedItems: unknown[] = [];
		const addItem = (owned: unknown) => ownedItems.push(owned);
		const game = {
			characters: { [USER_ID]: { coins: 100, items: ownedItems, addItem } },
			shop: {
				name: 'Moon Market', adjective: 'moss-covered', closingTime: new Date(Date.now() + 60_000),
				priceOffset: 0.8, backRoomOffset: 5, items: [potion], backRoom: [], cards: [], pronouns: {},
			},
			commitShop(next: any) { game.shop = next; },
		};
		const lanes: string[] = [];
		const roomManager = {
			assertMember: async () => undefined,
			getGame: async () => game,
			getEventBus: async () => ({ getPendingPromptForUser: () => null }),
			runSerializedEngineWork: async (lane: string, fn: () => Promise<unknown>) => {
				lanes.push(lane);
				return fn();
			},
		} as unknown as Parameters<typeof createRouter>[0];

		const caller = createRouter(roomManager).createCaller({ userId: USER_ID, serviceTokenValid: false });
		const result = await caller.game.buyShopItem({
			roomId: ROOM_ID, section: 'items', stockIndex: 0, expectedItemType: 'Potion',
			expectedClosingTime: game.shop.closingTime.toISOString(),
		});

		expect(result).to.deep.equal({ ok: true, itemName: 'Potion', price: 80, remainingCoins: 20 });
		expect(game.shop.items).to.deep.equal([]);
		expect(game.characters[USER_ID].items).to.deep.equal([potion]);
		expect(lanes).to.deep.equal([ROOM_ID]);
	});

	it('does not mutate another room when buying an item', async () => {
		const makeGame = () => {
			const potion = { itemType: 'Potion', cost: 50 };
			const owned: unknown[] = [];
			const game = {
				characters: { [USER_ID]: { coins: 100, items: owned, addItem: (item: unknown) => owned.push(item) } },
				shop: {
					name: 'Moon Market', adjective: 'moss-covered', closingTime: new Date(Date.now() + 60_000),
					priceOffset: 0.8, backRoomOffset: 5, items: [potion], backRoom: [], cards: [], pronouns: {},
				},
				commitShop(next: any) { game.shop = next; },
			};
			return game;
		};
		const otherRoomId = 'bbbbbbbb-cccc-dddd-eeee-ffffffffffff';
		const games = { [ROOM_ID]: makeGame(), [otherRoomId]: makeGame() };
		const roomManager = {
			assertMember: async () => undefined,
			getGame: async (roomId: keyof typeof games) => games[roomId],
			getEventBus: async () => ({ getPendingPromptForUser: () => null }),
			runSerializedEngineWork: async (_lane: string, fn: () => Promise<unknown>) => fn(),
		} as unknown as Parameters<typeof createRouter>[0];
		const caller = createRouter(roomManager).createCaller({ userId: USER_ID, serviceTokenValid: false });

		await caller.game.buyShopItem({
			roomId: ROOM_ID,
			section: 'items',
			stockIndex: 0,
			expectedItemType: 'Potion',
			expectedClosingTime: games[ROOM_ID].shop.closingTime.toISOString(),
		});

		expect(games[ROOM_ID].shop.items).to.have.lengthOf(0);
		expect(games[otherRoomId].shop.items).to.have.lengthOf(1);
		expect(games[otherRoomId].characters[USER_ID].coins).to.equal(100);
	});

	// Regression: the Workshop shop query only summarized `items` and `backRoom`, so cards
	// on sale (offered via the console's "Cards" menu, `items/store/buy.ts`) were invisible
	// and unbuyable from the web Workshop. See docs/roadmap/10b-bugs-fixed.md.
	it('includes cards in the shop summary, priced and owned like the console flow', async () => {
		const scroll = { cardType: 'Targeting Scroll', cost: 30, description: 'Aim a card.', stats: 'Usable 1 time.' };
		const game = {
			characters: { [USER_ID]: { coins: 75, items: [], deck: [scroll] } },
			shop: {
				name: 'Moon Market', adjective: 'moss-covered', closingTime: new Date('2030-01-01T00:00:00Z'),
				priceOffset: 0.8, backRoomOffset: 5, items: [], backRoom: [], cards: [scroll], pronouns: {},
			},
		};
		const roomManager = {
			assertMember: async () => undefined,
			getGame: async () => game,
		} as unknown as Parameters<typeof createRouter>[0];

		(roomManager as any).runSerializedEngineWork = async (_lane: string, fn: () => Promise<unknown>) => fn();
		const caller = createRouter(roomManager).createCaller({ userId: USER_ID, serviceTokenValid: false });
		const result = await caller.game.shop({ roomId: ROOM_ID });

		// priceOffset (0.8) * 2 = 1.6 — the same multiplier the summary uses for `items`.
		expect(result.cards[0]).to.deep.include({
			stockIndex: 0, section: 'cards', displayName: 'Targeting Scroll', price: 48,
			affordable: true, ownedCount: 1, description: 'Aim a card.',
		});
	});

	it('buys a card through the workshop shop and adds it to the deck, not the item list', async () => {
		const scroll = { cardType: 'Targeting Scroll', cost: 30 };
		const ownedItems: unknown[] = [];
		const ownedDeck: unknown[] = [];
		const game = {
			characters: {
				[USER_ID]: {
					coins: 100,
					items: ownedItems,
					deck: ownedDeck,
					addItem: (owned: unknown) => ownedItems.push(owned),
					addCard: (owned: unknown) => ownedDeck.push(owned),
				},
			},
			shop: {
				name: 'Moon Market', adjective: 'moss-covered', closingTime: new Date(Date.now() + 60_000),
				priceOffset: 0.8, backRoomOffset: 5, items: [], backRoom: [], cards: [scroll], pronouns: {},
			},
			commitShop(next: any) { game.shop = next; },
		};
		const roomManager = {
			assertMember: async () => undefined,
			getGame: async () => game,
			getEventBus: async () => ({ getPendingPromptForUser: () => null }),
			runSerializedEngineWork: async (_lane: string, fn: () => Promise<unknown>) => fn(),
		} as unknown as Parameters<typeof createRouter>[0];

		const caller = createRouter(roomManager).createCaller({ userId: USER_ID, serviceTokenValid: false });
		const result = await caller.game.buyShopItem({
			roomId: ROOM_ID, section: 'cards', stockIndex: 0, expectedItemType: 'Targeting Scroll',
			expectedClosingTime: game.shop.closingTime.toISOString(),
		});

		expect(result).to.deep.equal({ ok: true, itemName: 'Targeting Scroll', price: 48, remainingCoins: 52 });
		expect(game.shop.cards).to.deep.equal([]);
		expect(ownedDeck).to.deep.equal([scroll]);
		expect(ownedItems).to.deep.equal([]);
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

	it('maps engine mutation failures to BAD_REQUEST errors with message', async () => {
		const roomManager = {
			assertMember: async () => undefined,
			getGame: async () => ({
				characters: { [USER_ID]: { unequipCard: async () => ({}) } },
			}),
			getEventBus: async () => ({ publish: () => undefined }),
			runSerializedEngineWork: async () => {
				throw new Error('Cannot unequip while in encounter');
			},
		} as unknown as Parameters<typeof createRouter>[0];

		const router = createRouter(roomManager);
		const caller = router.createCaller({ userId: USER_ID, serviceTokenValid: false });
		const err = await caller.game.unequipCard({
			roomId: ROOM_ID,
			monsterName: 'Stonefang',
			cardName: 'Hit',
		}).catch((e: unknown) => e);

		expect(err).to.be.instanceOf(TRPCError);
		expect((err as TRPCError).code).to.equal('BAD_REQUEST');
		expect((err as TRPCError).message).to.equal('Cannot unequip while in encounter');
	});

	it('runs game.unequipMany as a single serialized lane and aggregates removedCount', async () => {
		const calls: Array<{ cardName: string; count?: number }> = [];
		const unequipCard = async ({ cardName, count }: { cardName: string; count?: number }) => {
			calls.push({ cardName, count });
			return { removedCount: count ?? 1, monsterName: 'Stonefang' };
		};
		let serializedCallCount = 0;
		const roomManager = {
			assertMember: async () => undefined,
			getGame: async () => ({
				characters: { [USER_ID]: { unequipCard } },
			}),
			getEventBus: async () => ({ publish: () => undefined }),
			runSerializedEngineWork: async (_roomId: string, fn: () => Promise<unknown>) => {
				serializedCallCount += 1;
				return fn();
			},
		} as unknown as Parameters<typeof createRouter>[0];

		const router = createRouter(roomManager);
		const caller = router.createCaller({ userId: USER_ID, serviceTokenValid: false });
		const result = await caller.game.unequipMany({
			roomId: ROOM_ID,
			monsterName: 'Stonefang',
			cards: [
				{ cardName: 'Hit', count: 2 },
				{ cardName: 'Heal', count: 1 },
			],
		});

		expect(serializedCallCount).to.equal(1);
		expect(calls).to.deep.equal([
			{ cardName: 'Hit', count: 2 },
			{ cardName: 'Heal', count: 1 },
		]);
		expect(result).to.deep.equal({ removedCount: 3, monsterName: 'Stonefang', failures: [] });
	});

	it('unequipMany reports per-card failures instead of throwing away a partial batch', async () => {
		// A batch is not atomic: if a later card fails, the earlier ones stay
		// unequipped. Throwing here would leave the client showing stale inventory
		// (its cache only invalidates on success) next to an error message.
		const unequipCard = async ({ cardName }: { cardName: string }) => {
			if (cardName === 'Heal') throw new Error('Cannot unequip while in encounter');
			return { removedCount: 1, monsterName: 'Stonefang' };
		};
		const roomManager = {
			assertMember: async () => undefined,
			getGame: async () => ({ characters: { [USER_ID]: { unequipCard } } }),
			getEventBus: async () => ({ publish: () => undefined, getPendingPromptForUser: () => null }),
			runSerializedEngineWork: async (_roomId: string, fn: () => Promise<unknown>) => fn(),
		} as unknown as Parameters<typeof createRouter>[0];

		const router = createRouter(roomManager);
		const caller = router.createCaller({ userId: USER_ID, serviceTokenValid: false });
		const result = await caller.game.unequipMany({
			roomId: ROOM_ID,
			monsterName: 'Stonefang',
			cards: [{ cardName: 'Hit' }, { cardName: 'Heal' }, { cardName: 'Blink' }],
		});

		expect(result.removedCount).to.equal(2);
		expect(result.failures).to.deep.equal([
			{ cardName: 'Heal', reason: 'Cannot unequip while in encounter' },
		]);
	});

	it('unequipMany still throws when the whole batch fails and nothing changed', async () => {
		const unequipCard = async () => {
			throw new Error('Cannot unequip while in encounter');
		};
		const roomManager = {
			assertMember: async () => undefined,
			getGame: async () => ({ characters: { [USER_ID]: { unequipCard } } }),
			getEventBus: async () => ({ publish: () => undefined, getPendingPromptForUser: () => null }),
			runSerializedEngineWork: async (_roomId: string, fn: () => Promise<unknown>) => fn(),
		} as unknown as Parameters<typeof createRouter>[0];

		const router = createRouter(roomManager);
		const caller = router.createCaller({ userId: USER_ID, serviceTokenValid: false });
		const err = await caller.game
			.unequipMany({ roomId: ROOM_ID, monsterName: 'Stonefang', cards: [{ cardName: 'Hit' }] })
			.catch((e: unknown) => e);

		expect(err).to.be.instanceOf(TRPCError);
		expect((err as TRPCError).code).to.equal('BAD_REQUEST');
		expect((err as TRPCError).message).to.equal('Cannot unequip while in encounter');
	});

	it('runs game.moveMany as a single serialized lane and aggregates movedCount', async () => {
		const calls: Array<{ cardName: string; count?: number }> = [];
		const moveCard = async ({ cardName, count }: { cardName: string; count?: number }) => {
			calls.push({ cardName, count });
			return { movedCount: count ?? 1, fromMonsterName: 'Stonefang', toMonsterName: 'Mirebell' };
		};
		let serializedCallCount = 0;
		const roomManager = {
			assertMember: async () => undefined,
			getGame: async () => ({
				characters: { [USER_ID]: { moveCard } },
			}),
			getEventBus: async () => ({ publish: () => undefined }),
			runSerializedEngineWork: async (_roomId: string, fn: () => Promise<unknown>) => {
				serializedCallCount += 1;
				return fn();
			},
		} as unknown as Parameters<typeof createRouter>[0];

		const router = createRouter(roomManager);
		const caller = router.createCaller({ userId: USER_ID, serviceTokenValid: false });
		const result = await caller.game.moveMany({
			roomId: ROOM_ID,
			fromMonsterName: 'Stonefang',
			toMonsterName: 'Mirebell',
			cards: [
				{ cardName: 'Hit', count: 2 },
				{ cardName: 'Heal', count: 1 },
			],
		});

		expect(serializedCallCount).to.equal(1);
		expect(calls).to.deep.equal([
			{ cardName: 'Hit', count: 2 },
			{ cardName: 'Heal', count: 1 },
		]);
		expect(result).to.deep.equal({
			movedCount: 3,
			fromMonsterName: 'Stonefang',
			toMonsterName: 'Mirebell',
			failures: [],
		});
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
		let receivedInput: Record<string, unknown> | undefined;
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

		expect(receivedInput).to.not.equal(undefined);
		if (!receivedInput) throw new Error('Expected equipCards to be called');
		const callInput = receivedInput;
		expect(callInput.monsterName).to.equal('Stonefang');
		expect(callInput.cardNames).to.deep.equal(['Hit', 'Heal']);
		expect(callInput.replaceAll).to.equal(false);
		expect(result).to.deep.equal({
			equippedCount: 1,
			requestedCount: 2,
			skippedCards: ['Heal'],
		});
	});

	it('routes game.reorderCards through character.reorderCards', async () => {
		let receivedInput: Record<string, unknown> | undefined;
		const publishedEvents: Array<{ type?: unknown; payload?: Record<string, unknown> }> = [];
		const reorderCards = async (input: Record<string, unknown>) => {
			receivedInput = input;
			return {
				monsterName: 'Stonefang',
				fromIndex: 0,
				toIndex: 1,
				cards: ['Heal', 'Hit'],
			};
		};

		const roomManager = {
			assertMember: async () => undefined,
			getGame: async () => ({
				characters: { [USER_ID]: { reorderCards } },
			}),
			getEventBus: async () => ({
				publish: (event: { type?: unknown; payload?: Record<string, unknown> }) => {
					publishedEvents.push(event);
				},
			}),
			runSerializedEngineWork: async (_roomId: string, fn: () => Promise<unknown>) => fn(),
		} as unknown as Parameters<typeof createRouter>[0];

		const router = createRouter(roomManager);
		const caller = router.createCaller({ userId: USER_ID, serviceTokenValid: false });
		const result = await caller.game.reorderCards({
			roomId: ROOM_ID,
			monsterName: 'Stonefang',
			fromIndex: 0,
			toIndex: 1,
		});

		expect(receivedInput).to.not.equal(undefined);
		if (!receivedInput) throw new Error('Expected reorderCards to be called');
		const callInput = receivedInput;
		expect(callInput.monsterName).to.equal('Stonefang');
		expect(callInput.fromIndex).to.equal(0);
		expect(callInput.toIndex).to.equal(1);
		expect(result).to.deep.equal({
			monsterName: 'Stonefang',
			fromIndex: 0,
			toIndex: 1,
			cards: ['Heal', 'Hit'],
		});
		const cardEquippedEvents = publishedEvents.filter((event) => event.type === 'card.equipped');
		expect(cardEquippedEvents).to.have.length(1);
		expect(cardEquippedEvents[0]?.payload).to.deep.equal({
			operation: 'reorderCards',
			monsterName: 'Stonefang',
			fromIndex: 0,
			toIndex: 1,
			cards: ['Heal', 'Hit'],
		});
	});
});

describe('trpc/router monster lifecycle procedures', () => {
	it('exposes the authoritative spawn catalog only to room members', async () => {
		let assertedRoom: string | undefined;
		const roomManager = {
			assertMember: async (_userId: string, roomId: string) => { assertedRoom = roomId; },
		} as unknown as Parameters<typeof createRouter>[0];
		const caller = createRouter(roomManager).createCaller({ userId: USER_ID, serviceTokenValid: false });

		const options = await caller.game.spawnOptions({ roomId: ROOM_ID });

		expect(assertedRoom).to.equal(ROOM_ID);
		expect(options.types.map((type) => type.label)).to.deep.equal([
			'Basilisk', 'Gladiator', 'Jinn', 'Minotaur', 'Weeping Angel',
		]);
		expect(options.genders).to.deep.equal(['female', 'male', 'androgynous']);
	});

	it('spawns a fully specified monster without an interactive prompt', async () => {
		let spawnInput: Record<string, unknown> | undefined;
		const character = { spawnMonster: async (_channel: unknown, input: Record<string, unknown>) => { spawnInput = input; return { givenName: 'Saffron', creatureType: 'Jinn' }; } };
		const roomManager = {
			assertMember: async () => undefined,
			getGame: async () => ({ characters: { [USER_ID]: character }, getAllMonstersLookup: () => ({}) }),
			getEventBus: async () => ({ publish: () => undefined, getPendingPromptForUser: () => null }),
			runSerializedEngineWork: async (_roomId: string, fn: () => Promise<unknown>) => fn(),
		} as unknown as Parameters<typeof createRouter>[0];
		const caller = createRouter(roomManager).createCaller({ userId: USER_ID, serviceTokenValid: false });
		const result = await caller.game.spawnMonster({ roomId: ROOM_ID, type: 2, gender: 'female', name: 'Saffron', color: 'violet smoke' });
		expect(spawnInput).to.include({ type: 2, gender: 'female', name: 'Saffron', color: 'violet smoke' });
		expect(result).to.deep.equal({ ok: true, monsterName: 'Saffron', monsterType: 'Jinn' });
	});

	it('revives only the authenticated member\'s monster in the requested room', async () => {
		const calls: unknown[] = [];
		const character = {
			reviveMonster: async (input: unknown) => {
				calls.push(input);
				return { givenName: 'Stonefang' };
			},
		};
		const roomManager = {
			assertMember: async (userId: string, roomId: string) => {
				expect(userId).to.equal(USER_ID);
				expect(roomId).to.equal(ROOM_ID);
			},
			getGame: async (roomId: string) => {
				expect(roomId).to.equal(ROOM_ID);
				return { characters: { [USER_ID]: character } };
			},
			getEventBus: async () => ({ publish: () => undefined, getPendingPromptForUser: () => null }),
			runSerializedEngineWork: async (roomId: string, fn: () => Promise<unknown>) => {
				expect(roomId).to.equal(ROOM_ID);
				return fn();
			},
		} as unknown as Parameters<typeof createRouter>[0];

		const caller = createRouter(roomManager).createCaller({ userId: USER_ID, serviceTokenValid: false });
		const result = await caller.game.reviveMonster({ roomId: ROOM_ID, monsterName: 'Stonefang' });

		expect(result).to.deep.equal({ ok: true, monsterName: 'Stonefang' });
		expect(calls).to.have.length(1);
		expect(calls[0]).to.include({ monsterName: 'Stonefang' });
	});

	it('sends through the requested room ring with authenticated ownership', async () => {
		let sent: Record<string, unknown> | undefined;
		const ring = { contestants: [] };
		const character = {
			sendMonsterToTheRing: async (input: Record<string, unknown>) => { sent = input; },
		};
		const roomManager = {
			assertMember: async () => undefined,
			getGame: async () => ({ characters: { [USER_ID]: character }, ring }),
			getEventBus: async () => ({ publish: () => undefined, getPendingPromptForUser: () => null }),
			runSerializedEngineWork: async (_roomId: string, fn: () => Promise<unknown>) => fn(),
		} as unknown as Parameters<typeof createRouter>[0];

		const caller = createRouter(roomManager).createCaller({ userId: USER_ID, serviceTokenValid: false });
		await caller.game.sendMonsterToRing({ roomId: ROOM_ID, monsterName: 'Stonefang' });

		expect(sent).to.include({ monsterName: 'Stonefang', ring, userId: USER_ID });
	});

	it('checks room membership before loading lifecycle state', async () => {
		let loaded = false;
		const roomManager = {
			assertMember: async () => { throw new TRPCError({ code: 'FORBIDDEN' }); },
			getGame: async () => { loaded = true; return {}; },
		} as unknown as Parameters<typeof createRouter>[0];
		const caller = createRouter(roomManager).createCaller({ userId: USER_ID, serviceTokenValid: false });

		const error = await caller.game.sendMonsterToRing({ roomId: ROOM_ID, monsterName: 'Stonefang' }).catch((err) => err);
		expect(error).to.be.instanceOf(TRPCError);
		expect(loaded).to.equal(false);
	});
});

/**
 * Training a monster was a brand-new player's first action in the workshop, and it
 * dead-ended: `game.spawnMonster` refused because there was no character, and the workshop
 * had no way to make one (the console's creation flow is a series of prompts, which a
 * workshop mutation cannot run — docs/engine-concurrency-and-timing.md). The fix carries
 * the character's details in the spawn itself, prompt-free.
 */
describe('trpc/router first-run character creation from the workshop', () => {
	const CHARACTER_BLOCK = { name: 'Ada', gender: 'female' as const, avatar: '🦊' };

	const makeRoomManager = (game: unknown, displayName = 'Ada Lovelace', spy?: { assertedRoom?: string }) =>
		({
			assertMember: async (_userId: string, roomId: string) => {
				if (spy) spy.assertedRoom = roomId;
			},
			getGame: async () => game,
			getEventBus: async () => ({ publish: () => undefined, getPendingPromptForUser: () => null }),
			runSerializedEngineWork: async (_roomId: string, fn: () => Promise<unknown>) => fn(),
			getDisplayName: async () => displayName,
		}) as unknown as Parameters<typeof createRouter>[0];

	it('creates the character and spawns the monster in one mutation', async () => {
		// A real Game so the character that comes out is a real Beastmaster, registered in
		// this room's state — a stub would only prove the router called something.
		const game = new Game({}, () => undefined);
		try {
			const caller = createRouter(makeRoomManager(game)).createCaller({ userId: USER_ID, serviceTokenValid: false });

			const result = await caller.game.spawnMonster({
				roomId: ROOM_ID,
				type: 2,
				gender: 'female',
				name: 'Saffron',
				color: 'violet smoke',
				character: CHARACTER_BLOCK,
			});

			const character = game.characters[USER_ID] as Record<string, unknown>;
			expect(character.creatureType).to.equal('Beastmaster');
			expect(character).to.include({ givenName: 'Ada', gender: 'female', icon: '🦊' });
			expect(result.monsterName).to.equal('Saffron');
			expect(result.monsterType).to.equal('Jinn');
			expect((character.monsters as unknown[])).to.have.length(1);
		} finally {
			game.dispose();
		}
	});

	it('asks for the character details instead of just refusing', async () => {
		const caller = createRouter(makeRoomManager({ characters: {} })).createCaller({ userId: USER_ID, serviceTokenValid: false });

		const error = await caller.game.spawnMonster({ roomId: ROOM_ID, type: 2, gender: 'female', name: 'Saffron', color: 'violet smoke' })
			.catch((err: unknown) => err);

		expect(error).to.be.instanceOf(TRPCError);
		expect((error as TRPCError).code).to.equal('NOT_FOUND');
		expect((error as TRPCError).message).to.equal("You don't have a character in this room yet — fill in the character details to create one.");
	});

	it('refuses a character name another player already took, before the engine can prompt about it', async () => {
		// `createCharacter` re-prompts on a clash, and the workshop channel throws on any
		// question — so the clash has to be a refusal here, not a prompt there.
		let created = false;
		const game = {
			characters: {},
			findCharacterByName: (name: string) => (name === 'Ada' ? { givenName: 'Ada' } : undefined),
			getCharacter: async () => { created = true; return {}; },
			getAllMonstersLookup: () => ({}),
		};
		const caller = createRouter(makeRoomManager(game)).createCaller({ userId: USER_ID, serviceTokenValid: false });

		const error = await caller.game.spawnMonster({
			roomId: ROOM_ID, type: 2, gender: 'female', name: 'Saffron', color: 'violet smoke', character: CHARACTER_BLOCK,
		}).catch((err: unknown) => err);

		expect(error).to.be.instanceOf(TRPCError);
		expect((error as TRPCError).code).to.equal('CONFLICT');
		expect((error as TRPCError).message).to.equal('That name is already taken in this room.');
		expect(created).to.equal(false);
		expect(game.characters).to.deep.equal({});
	});

	it('ignores the character block when the player already has a character', async () => {
		let spawnInput: Record<string, unknown> | undefined;
		let createdAgain = false;
		const character = {
			givenName: 'Grace',
			spawnMonster: async (_channel: unknown, spawn: Record<string, unknown>) => { spawnInput = spawn; return { givenName: 'Saffron', creatureType: 'Jinn' }; },
		};
		const game = {
			characters: { [USER_ID]: character },
			getCharacter: async () => { createdAgain = true; return character; },
			findCharacterByName: () => undefined,
			getAllMonstersLookup: () => ({}),
		};
		const caller = createRouter(makeRoomManager(game)).createCaller({ userId: USER_ID, serviceTokenValid: false });

		const result = await caller.game.spawnMonster({
			roomId: ROOM_ID, type: 2, gender: 'female', name: 'Saffron', color: 'violet smoke', character: CHARACTER_BLOCK,
		});

		expect(createdAgain).to.equal(false);
		expect(game.characters[USER_ID].givenName).to.equal('Grace');
		expect(spawnInput).to.not.have.property('character');
		expect(result.monsterName).to.equal('Saffron');
	});

	it('offers the creation choices the workshop form cannot ask for, to room members only', async () => {
		const spy: { assertedRoom?: string } = {};
		const caller = createRouter(makeRoomManager({ characters: {} }, 'Ada Lovelace', spy)).createCaller({ userId: USER_ID, serviceTokenValid: false });

		const choices = await caller.game.characterCreationChoices({ roomId: ROOM_ID });

		expect(spy.assertedRoom).to.equal(ROOM_ID);
		expect(choices.avatars).to.have.length(7);
		expect(choices.genders).to.deep.equal(['male', 'female', 'androgynous']);
		expect(choices.suggestedName).to.equal('Ada Lovelace');
	});

	it('tells the workshop there is no character yet, rather than an empty stable', async () => {
		const roomManager = {
			assertMember: async () => undefined,
			getGame: async () => ({ characters: {}, ring: { contestants: [] } }),
		} as unknown as Parameters<typeof createRouter>[0];
		const caller = createRouter(roomManager).createCaller({ userId: USER_ID, serviceTokenValid: false });

		const result = await caller.game.myInventory({ roomId: ROOM_ID });

		expect(result.hasCharacter).to.equal(false);
		expect(result.monsters).to.deep.equal([]);
	});
});

/**
 * Items are the one thing a player can still do once the bell rings, and until this
 * procedure existed the web client could list them but not use one. See
 * docs/roadmap/19-player-agency-and-items.md §8.
 */
describe('trpc/router useItem', () => {
	const makeRoomManager = (character: unknown, spy?: { assertedRoom?: string }) =>
		({
			assertMember: async (_userId: string, roomId: string) => {
				if (spy) spy.assertedRoom = roomId;
			},
			getGame: async () => ({ characters: { [USER_ID]: character }, ring: { contestants: [] } }),
			getEventBus: async () => ({ publish: () => undefined, getPendingPromptForUser: () => null }),
			runSerializedEngineWork: async (_roomId: string, fn: () => Promise<unknown>) => fn(),
		}) as unknown as Parameters<typeof createRouter>[0];

	it('uses a named item on a named monster', async () => {
		let used: Record<string, unknown> | undefined;
		const character = { useItems: async (input: Record<string, unknown>) => { used = input; } };
		const caller = createRouter(makeRoomManager(character)).createCaller({
			userId: USER_ID,
			serviceTokenValid: false,
		});

		const result = await caller.game.useItem({
			roomId: ROOM_ID,
			itemName: 'Healing Potion',
			monsterName: 'Stonefang',
		});

		expect(result).to.deep.equal({
			ok: true,
			applied: true,
			itemName: 'Healing Potion',
			monsterName: 'Stonefang',
		});
		expect(used).to.include({ monsterName: 'Stonefang' });
		expect(used?.itemSelection).to.deep.equal(['Healing Potion']);
	});

	it('confirms on the caller\'s behalf, because a prompt cannot be answered in a mutation', async () => {
		// Without this the engine asks "Are you sure? (yes/no)" and the silent channel throws.
		let used: Record<string, unknown> | undefined;
		const character = { useItems: async (input: Record<string, unknown>) => { used = input; } };
		const caller = createRouter(makeRoomManager(character)).createCaller({
			userId: USER_ID,
			serviceTokenValid: false,
		});

		await caller.game.useItem({ roomId: ROOM_ID, itemName: 'Healing Potion', monsterName: 'Stonefang' });

		expect(used?.confirmed).to.equal(true);
	});

	it('uses on the character when no monster is named', async () => {
		let used: Record<string, unknown> | undefined;
		const character = { useItems: async (input: Record<string, unknown>) => { used = input; } };
		const caller = createRouter(makeRoomManager(character)).createCaller({
			userId: USER_ID,
			serviceTokenValid: false,
		});

		await caller.game.useItem({ roomId: ROOM_ID, itemName: 'Lottery Ticket' });

		// Undefined rather than empty-string: the engine branches on truthiness to decide
		// whether to look up a monster at all.
		expect(used?.monsterName).to.equal(undefined);
	});

	it('surfaces an engine refusal as a BAD_REQUEST rather than a 500', async () => {
		const character = {
			useItems: async () => { throw new Error('Character can not use that on Stonefang.'); },
		};
		const caller = createRouter(makeRoomManager(character)).createCaller({
			userId: USER_ID,
			serviceTokenValid: false,
		});

		const error = await caller.game
			.useItem({ roomId: ROOM_ID, itemName: 'Nonexistent', monsterName: 'Stonefang' })
			.catch((err) => err);

		expect(error).to.be.instanceOf(TRPCError);
		expect((error as TRPCError).code).to.equal('BAD_REQUEST');
		expect((error as TRPCError).message).to.contain('can not use');
	});

	it('checks room membership before touching game state', async () => {
		let loaded = false;
		const roomManager = {
			assertMember: async () => { throw new TRPCError({ code: 'FORBIDDEN' }); },
			getGame: async () => { loaded = true; return {}; },
		} as unknown as Parameters<typeof createRouter>[0];
		const caller = createRouter(roomManager).createCaller({ userId: USER_ID, serviceTokenValid: false });

		const error = await caller.game
			.useItem({ roomId: ROOM_ID, itemName: 'Healing Potion' })
			.catch((err) => err);

		expect(error).to.be.instanceOf(TRPCError);
		expect(loaded).to.equal(false);
	});

	it('scopes the membership check to the requested room', async () => {
		const spy: { assertedRoom?: string } = {};
		const character = { useItems: async () => undefined };
		const caller = createRouter(makeRoomManager(character, spy)).createCaller({
			userId: USER_ID,
			serviceTokenValid: false,
		});

		await caller.game.useItem({ roomId: ROOM_ID, itemName: 'Healing Potion' });

		expect(spy.assertedRoom).to.equal(ROOM_ID);
	});

	/**
	 * `canUseItem` is a compatibility check (it is `canHoldItem`), so neither the client's
	 * tier nor this procedure knows whether the item's own conditions hold. Spin Up on a
	 * living monster returns false and is deliberately not consumed — reporting plain `ok`
	 * told the player it was used when nothing happened. Codex review on #372.
	 */
	it('reports applied: false when the item declined to act', async () => {
		const character = { useItems: async () => [false] };
		const caller = createRouter(makeRoomManager(character)).createCaller({
			userId: USER_ID,
			serviceTokenValid: false,
		});

		const result = await caller.game.useItem({
			roomId: ROOM_ID,
			itemName: 'Spin Up',
			monsterName: 'Stonefang',
		});

		expect(result.applied).to.equal(false);
	});

	it('reports applied: true when the item did something', async () => {
		const character = { useItems: async () => [true] };
		const caller = createRouter(makeRoomManager(character)).createCaller({
			userId: USER_ID,
			serviceTokenValid: false,
		});

		const result = await caller.game.useItem({ roomId: ROOM_ID, itemName: 'Healing Potion' });

		expect(result.applied).to.equal(true);
	});

	it('treats a non-boolean result as applied, since most items return a use count', async () => {
		const character = { useItems: async () => [1] };
		const caller = createRouter(makeRoomManager(character)).createCaller({
			userId: USER_ID,
			serviceTokenValid: false,
		});

		const result = await caller.game.useItem({ roomId: ROOM_ID, itemName: 'Lottery Ticket' });

		expect(result.applied).to.equal(true);
	});

	it('passes the clicked row through as itemSource', async () => {
		// Both pools can hold the same type; without this the engine spends the monster's.
		let used: Record<string, unknown> | undefined;
		const character = { useItems: async (input: Record<string, unknown>) => { used = input; return [true]; } };
		const caller = createRouter(makeRoomManager(character)).createCaller({
			userId: USER_ID,
			serviceTokenValid: false,
		});

		await caller.game.useItem({
			roomId: ROOM_ID,
			itemName: 'Chaos Theory for Beginners',
			monsterName: 'Stonefang',
			itemSource: 'character',
		});

		expect(used?.itemSource).to.equal('character');
	});

	it('404s when the user has no character in the room', async () => {
		const caller = createRouter(makeRoomManager(undefined)).createCaller({
			userId: USER_ID,
			serviceTokenValid: false,
		});

		const error = await caller.game
			.useItem({ roomId: ROOM_ID, itemName: 'Healing Potion' })
			.catch((err) => err);

		expect((error as TRPCError).code).to.equal('NOT_FOUND');
	});
});

describe('trpc/router ringFeed replay', () => {
	type Frame = { id: string; data: { type: string; text: string } };

	// `tracked(id, event)` surfaces as an [id, event] tuple through createCaller.
	const unwrap = (frame: unknown): Frame['data'] =>
		(Array.isArray(frame) ? frame[1] : frame) as Frame['data'];

	const makeEvent = (id: string, text: string) => ({
		id,
		roomId: ROOM_ID,
		timestamp: Date.now(),
		type: 'announce',
		scope: 'public',
		text,
		payload: {},
	});

	/**
	 * Builds a roomManager whose in-memory cursor lookup returns `sinceResult` and
	 * whose durable-storage fallback returns `storedEvents`. The live subscription
	 * immediately delivers a sentinel so the frame after replay is deterministic.
	 */
	const makeRoomManager = (
		sinceResult: Record<string, unknown>,
		storedEvents: unknown[]
	) =>
		({
			assertMember: async () => undefined,
			getEventBus: async () => ({
				getEventsSince: () => sinceResult,
				getRecentEvents: () => [],
				subscribe: (_id: string, sub: { deliver: (e: unknown) => void }) => {
					sub.deliver(makeEvent('9999999999999-live', 'live'));
					return () => {};
				},
			}),
			getGame: async () => ({
				ring: { nextFightAt: null, nextBossSpawnAt: null, contestants: [], inEncounter: false, contestantSnapshots: () => [] },
			}),
			getEventsSinceForRingFeed: async () => ({ events: storedEvents, limitReached: false }),
		}) as unknown as Parameters<typeof createRouter>[0];

	const collect = async (
		roomManager: Parameters<typeof createRouter>[0],
		frameCount: number
	) => {
		const router = createRouter(roomManager);
		const caller = router.createCaller({ userId: USER_ID, serviceTokenValid: false });
		const iterator = (await caller.game.ringFeed({
			roomId: ROOM_ID,
			lastEventId: '1712835000000-cursor',
		})) as AsyncGenerator<unknown>;

		const frames: Array<Frame['data']> = [];
		try {
			for (let i = 0; i < frameCount; i++) {
				const next = await iterator.next();
				if (next.done) break;
				frames.push(unwrap(next.value));
			}
		} finally {
			await iterator.return?.(undefined);
		}
		return frames;
	};

	it('replays from durable storage when the buffer is cold after a restart', async () => {
		// Regression: a cold buffer used to report truncated=false, so the DB
		// fallback never ran and reconnects across a restart replayed nothing.
		const roomManager = makeRoomManager(
			{ events: [], truncated: true, upToDate: false, status: 'cold' },
			[makeEvent('1712835000001-a', 'missed one'), makeEvent('1712835000002-b', 'missed two')]
		);

		const frames = await collect(roomManager, 3);

		expect(frames[0]?.type).to.equal('handshake');
		expect(frames.map((f) => f.text)).to.include('missed one');
		expect(frames.map((f) => f.text)).to.include('missed two');
		expect(frames.map((f) => f.type)).to.not.include('system.gap');
	});

	it('warns about a gap when events were evicted and storage has nothing', async () => {
		const roomManager = makeRoomManager(
			{ events: [], truncated: true, upToDate: false, status: 'evicted' },
			[]
		);

		const frames = await collect(roomManager, 2);

		expect(frames[0]?.type).to.equal('handshake');
		expect(frames[1]?.type).to.equal('system.gap');
	});

	it('does not warn about a gap when a cold buffer has nothing to replay', async () => {
		// The common case after a deploy: the room was idle, so an empty replay is
		// expected and must not surface a "you missed events" banner.
		const roomManager = makeRoomManager(
			{ events: [], truncated: true, upToDate: false, status: 'cold' },
			[]
		);

		const frames = await collect(roomManager, 2);

		expect(frames[0]?.type).to.equal('handshake');
		expect(frames[1]?.text).to.equal('live');
	});
});

describe('trpc/router command dispatch and flow locking', () => {
	const flowKey = `${ROOM_ID}:${USER_ID}`;

	function deferred<T = void>() {
		let resolve!: (value: T) => void;
		const promise = new Promise<T>((res) => {
			resolve = res;
		});
		return { promise, resolve };
	}

	/**
	 * roomManager double for the `command` mutation. `action` is what
	 * game.handleCommand returns; `lanes` records every runSerializedEngineWork
	 * key; `published` records every eventBus.publish.
	 */
	function makeCommandRoomManager(action: (opts: unknown) => Promise<unknown>) {
		const lanes: string[] = [];
		const published: Array<{ type: string }> = [];
		const roomManager = {
			assertMember: async () => undefined,
			getMemberRole: async () => 'member',
			getDisplayName: async () => 'Player',
			getGame: async () => ({
				handleCommand: () => action,
				characters: {},
				ring: { contestants: [] },
			}),
			getEventBus: async () => ({
				publish: (event: { type: string }) => published.push(event),
				getPendingPromptForUser: () => null,
				cancelAllUserPrompts: () => undefined,
			}),
			runSerializedEngineWork: async (laneKey: string, fn: () => Promise<unknown>) => {
				lanes.push(laneKey);
				return fn();
			},
		} as unknown as Parameters<typeof createRouter>[0];
		return { roomManager, lanes, published };
	}

	const settleTicks = async (count = 4) => {
		for (let i = 0; i < count; i++) {
			await new Promise<void>((resolve) => setImmediate(resolve));
		}
	};

	afterEach(() => {
		activeFlows.clear();
		activePromptFreeMutations.clear();
	});

	it('serializes command actions in a per-user lane, not room-wide', async () => {
		// Regression (bug doc #20): a room-wide lane let one user's minutes-long
		// interactive flow starve every other member's commands.
		const { roomManager, lanes } = makeCommandRoomManager(async () => undefined);
		const caller = createRouter(roomManager).createCaller({ userId: USER_ID, serviceTokenValid: false });

		const result = await caller.game.command({ roomId: ROOM_ID, command: 'look at ring' });
		await settleTicks();

		expect(result.ok).to.equal(true);
		expect(lanes).to.deep.equal([`${ROOM_ID}:${USER_ID}`]);
	});

	it('emits quick_actions to the user after the command action settles', async () => {
		const { roomManager, published } = makeCommandRoomManager(async () => undefined);
		const caller = createRouter(roomManager).createCaller({ userId: USER_ID, serviceTokenValid: false });

		await caller.game.command({ roomId: ROOM_ID, command: 'look at ring' });
		await settleTicks();

		expect(published.some((event) => event.type === 'quick_actions')).to.equal(true);
	});

	it('rejects workshop mutations while the caller has a console flow in progress', async () => {
		// Regression (bug doc #20): workshop mutations used to queue behind the
		// flow (hanging the HTTP request for minutes) instead of failing fast.
		const unequipCard = async () => ({ removedCount: 1, monsterName: 'Stonefang' });
		const roomManager = {
			assertMember: async () => undefined,
			getGame: async () => ({ characters: { [USER_ID]: { unequipCard } } }),
			getEventBus: async () => ({ publish: () => undefined, getPendingPromptForUser: () => null }),
			runSerializedEngineWork: async (_key: string, fn: () => Promise<unknown>) => fn(),
		} as unknown as Parameters<typeof createRouter>[0];
		const caller = createRouter(roomManager).createCaller({ userId: USER_ID, serviceTokenValid: false });

		activeFlows.set(flowKey, 'some-flow');

		const err = await caller.game
			.unequipCard({ roomId: ROOM_ID, monsterName: 'Stonefang', cardName: 'Hit' })
			.catch((e: unknown) => e);

		expect(err).to.be.instanceOf(TRPCError);
		expect((err as TRPCError).code).to.equal('PRECONDITION_FAILED');
		expect((err as TRPCError).message).to.equal('Still processing your previous command — try again in a moment.');
	});

	it('reports the "answer the prompt" message when a console flow has a pending prompt', async () => {
		const unequipCard = async () => ({ removedCount: 1, monsterName: 'Stonefang' });
		const roomManager = {
			assertMember: async () => undefined,
			getGame: async () => ({ characters: { [USER_ID]: { unequipCard } } }),
			getEventBus: async () => ({
				publish: () => undefined,
				getPendingPromptForUser: () => ({ requestId: 'req-1', question: 'Q', choices: ['0'], timeoutSeconds: 120 }),
			}),
			runSerializedEngineWork: async (_key: string, fn: () => Promise<unknown>) => fn(),
		} as unknown as Parameters<typeof createRouter>[0];
		const caller = createRouter(roomManager).createCaller({ userId: USER_ID, serviceTokenValid: false });

		activeFlows.set(flowKey, 'some-flow');

		const err = await caller.game
			.unequipCard({ roomId: ROOM_ID, monsterName: 'Stonefang', cardName: 'Hit' })
			.catch((e: unknown) => e);

		expect(err).to.be.instanceOf(TRPCError);
		expect((err as TRPCError).code).to.equal('PRECONDITION_FAILED');
		expect((err as TRPCError).message).to.equal('A console command is in progress — answer or cancel its prompt first.');
	});

	it('rejects console commands while the same user has a workshop mutation in flight', async () => {
		const workshop = deferred<{ removedCount: number; monsterName: string }>();
		const unequipCard = () => workshop.promise;
		const roomManager = {
			assertMember: async () => undefined,
			getGame: async () => ({ characters: { [USER_ID]: { unequipCard } } }),
			getEventBus: async () => ({ publish: () => undefined, getPendingPromptForUser: () => null }),
			runSerializedEngineWork: async (_key: string, fn: () => Promise<unknown>) => fn(),
		} as unknown as Parameters<typeof createRouter>[0];
		const caller = createRouter(roomManager).createCaller({ userId: USER_ID, serviceTokenValid: false });
		const { roomManager: commandRm } = makeCommandRoomManager(async () => undefined);
		const commandCaller = createRouter(commandRm).createCaller({ userId: USER_ID, serviceTokenValid: false });

		const workshopCall = caller.game.unequipCard({
			roomId: ROOM_ID,
			monsterName: 'Stonefang',
			cardName: 'Hit',
		});
		await settleTicks();
		expect(activePromptFreeMutations.has(flowKey)).to.equal(true);

		const consoleResult = await commandCaller.game.command({ roomId: ROOM_ID, command: 'look at ring' });
		expect(consoleResult.ok).to.equal(false);
		expect(consoleResult.message).to.equal(
			'A workshop operation is in progress — wait for it to finish before submitting a command.'
		);

		workshop.resolve({ removedCount: 1, monsterName: 'Stonefang' });
		await workshopCall;
		await settleTicks();
		expect(activePromptFreeMutations.has(flowKey)).to.equal(false);
	});

	it('allows another user\'s console command while a workshop mutation is in flight', async () => {
		const workshop = deferred<{ removedCount: number; monsterName: string }>();
		const unequipCard = () => workshop.promise;
		const roomManager = {
			assertMember: async () => undefined,
			getGame: async () => ({ characters: { [USER_ID]: { unequipCard } } }),
			getEventBus: async () => ({ publish: () => undefined, getPendingPromptForUser: () => null }),
			runSerializedEngineWork: async (_key: string, fn: () => Promise<unknown>) => fn(),
		} as unknown as Parameters<typeof createRouter>[0];
		const workshopCaller = createRouter(roomManager).createCaller({ userId: USER_ID, serviceTokenValid: false });
		const { roomManager: otherRm, lanes } = makeCommandRoomManager(async () => undefined);
		const otherCaller = createRouter(otherRm).createCaller({ userId: OTHER_USER_ID, serviceTokenValid: false });

		void workshopCaller.game.unequipCard({ roomId: ROOM_ID, monsterName: 'Stonefang', cardName: 'Hit' });
		await settleTicks();

		const consoleResult = await otherCaller.game.command({ roomId: ROOM_ID, command: 'look at ring' });
		await settleTicks();

		expect(consoleResult.ok).to.equal(true);
		expect(lanes).to.deep.equal([`${ROOM_ID}:${OTHER_USER_ID}`]);

		workshop.resolve({ removedCount: 1, monsterName: 'Stonefang' });
		await settleTicks();
	});

	it('releases the workshop guard when the mutation rejects', async () => {
		const unequipCard = async () => {
			throw new Error('deck full');
		};
		const roomManager = {
			assertMember: async () => undefined,
			getGame: async () => ({ characters: { [USER_ID]: { unequipCard } } }),
			getEventBus: async () => ({ publish: () => undefined, getPendingPromptForUser: () => null }),
			runSerializedEngineWork: async (_key: string, fn: () => Promise<unknown>) => fn(),
		} as unknown as Parameters<typeof createRouter>[0];
		const caller = createRouter(roomManager).createCaller({ userId: USER_ID, serviceTokenValid: false });

		const err = await caller.game
			.unequipCard({ roomId: ROOM_ID, monsterName: 'Stonefang', cardName: 'Hit' })
			.catch((e: unknown) => e);
		expect(err).to.be.instanceOf(TRPCError);
		expect(activePromptFreeMutations.has(flowKey)).to.equal(false);
	});

	it('reports an active console flow and its waiting prompt to graphical clients', async () => {
		const pendingPrompt = {
			requestId: 'prompt-1',
			question: 'Which card?',
			choices: ['Hit'],
			timeoutSeconds: 120,
		};
		const roomManager = {
			assertMember: async () => undefined,
			getEventBus: async () => ({ getPendingPromptForUser: () => pendingPrompt }),
		} as unknown as Parameters<typeof createRouter>[0];
		const caller = createRouter(roomManager).createCaller({ userId: USER_ID, serviceTokenValid: false });
		activeFlows.set(flowKey, 'command-1');

		try {
			const status = await caller.game.flowStatus({ roomId: ROOM_ID });
			expect(status).to.deep.equal({
				consoleActive: true,
				workshopActive: false,
				pendingPrompt,
			});
		} finally {
			activeFlows.delete(flowKey);
		}
	});

	it('a cancelled flow settling late does not release a newer flow\'s lock', async () => {
		// Regression (review of #20): cancelFlow deletes the key immediately; if
		// command B starts before cancelled command A's promise chain settles,
		// A's unconditional .finally() used to delete B's freshly-taken lock,
		// letting a third command run concurrently with B.
		const flowA = deferred();
		const flowB = deferred();
		const { roomManager: rmA } = makeCommandRoomManager(() => flowA.promise);
		const callerA = createRouter(rmA).createCaller({ userId: USER_ID, serviceTokenValid: false });

		const dispatchA = await callerA.game.command({ roomId: ROOM_ID, command: 'spawn monster' });
		expect(dispatchA.ok).to.equal(true);
		expect(activeFlows.has(flowKey)).to.equal(true);

		// User cancels flow A (the router's cancelFlow force-clears the lock).
		await callerA.game.cancelFlow({ roomId: ROOM_ID });
		expect(activeFlows.has(flowKey)).to.equal(false);

		// Command B starts while A's action promise is still unsettled.
		const { roomManager: rmB } = makeCommandRoomManager(() => flowB.promise);
		const callerB = createRouter(rmB).createCaller({ userId: USER_ID, serviceTokenValid: false });
		const dispatchB = await callerB.game.command({ roomId: ROOM_ID, command: 'spawn monster' });
		expect(dispatchB.ok).to.equal(true);
		const tokenB = activeFlows.get(flowKey);
		expect(tokenB).to.be.a('string');

		// A finally settles — its cleanup must NOT release B's lock.
		flowA.resolve();
		await settleTicks();
		expect(activeFlows.get(flowKey)).to.equal(tokenB);

		// When B settles, its own cleanup releases the lock normally.
		flowB.resolve();
		await settleTicks();
		expect(activeFlows.has(flowKey)).to.equal(false);
	});
});

describe('trpc/router ringFeed live-subscription race', () => {
	const unwrapFrame = (frame: unknown): { id: string; type: string; text: string } =>
		(Array.isArray(frame) ? frame[1] : frame) as { id: string; type: string; text: string };

	const makeEvent = (id: string, text: string) => ({
		id,
		roomId: ROOM_ID,
		timestamp: Date.now(),
		type: 'announce',
		scope: 'public',
		text,
		payload: {},
	});

	it('subscribes before replaying and dedups events captured by both', async () => {
		// Regression (review of #16/#17): the live subscriber used to attach only
		// after the replay finished, so events published during the (async) DB
		// replay were lost. Now the subscriber attaches first and buffered
		// duplicates of replayed events are dropped on drain.
		const order: string[] = [];
		const replayed = makeEvent('1712835000005-replayed', 'covered by replay');
		const inBetween = makeEvent('1712835000006-between', 'published during replay');

		const roomManager = {
			assertMember: async () => undefined,
			getEventBus: async () => ({
				getEventsSince: () => {
					order.push('getEventsSince');
					return { events: [], truncated: true, upToDate: false, status: 'cold' };
				},
				getRecentEvents: () => [],
				subscribe: (_id: string, sub: { deliver: (e: unknown) => void }) => {
					order.push('subscribe');
					// Simulate events arriving while the replay is being assembled:
					// one that the replay will also return, one that only the live
					// subscription sees.
					sub.deliver(replayed);
					sub.deliver(inBetween);
					return () => {};
				},
			}),
			getGame: async () => ({
				ring: { nextFightAt: null, nextBossSpawnAt: null, contestants: [], inEncounter: false, contestantSnapshots: () => [] },
			}),
			getEventsSinceForRingFeed: async () => ({ events: [replayed], limitReached: false }),
		} as unknown as Parameters<typeof createRouter>[0];

		const caller = createRouter(roomManager).createCaller({ userId: USER_ID, serviceTokenValid: false });
		const iterator = (await caller.game.ringFeed({
			roomId: ROOM_ID,
			lastEventId: '1712835000000-cursor',
		})) as AsyncGenerator<unknown>;

		const frames: Array<{ id: string; type: string; text: string }> = [];
		try {
			for (let i = 0; i < 3; i++) {
				const next = await iterator.next();
				if (next.done) break;
				frames.push(unwrapFrame(next.value));
			}
		} finally {
			await iterator.return?.(undefined);
		}

		expect(order[0]).to.equal('subscribe');
		expect(order).to.include('getEventsSince');
		expect(frames[0]?.type).to.equal('handshake');
		// The replayed event appears exactly once, then the in-between live event.
		expect(frames.filter((f) => f.id === replayed.id)).to.have.length(1);
		expect(frames.some((f) => f.id === inBetween.id)).to.equal(true);
	});

	it('emits a gap marker when the DB replay hits its hard cap', async () => {
		const events = [makeEvent('1712835000001-a', 'one'), makeEvent('1712835000002-b', 'two')];
		const roomManager = {
			assertMember: async () => undefined,
			getEventBus: async () => ({
				getEventsSince: () => ({ events: [], truncated: true, upToDate: false, status: 'evicted' }),
				getRecentEvents: () => [],
				subscribe: () => () => {},
			}),
			getGame: async () => ({
				ring: { nextFightAt: null, nextBossSpawnAt: null, contestants: [], inEncounter: false, contestantSnapshots: () => [] },
			}),
			getEventsSinceForRingFeed: async () => ({ events, limitReached: true }),
		} as unknown as Parameters<typeof createRouter>[0];

		const caller = createRouter(roomManager).createCaller({ userId: USER_ID, serviceTokenValid: false });
		const iterator = (await caller.game.ringFeed({
			roomId: ROOM_ID,
			lastEventId: '1712835000000-cursor',
		})) as AsyncGenerator<unknown>;

		const frames: Array<{ type: string }> = [];
		try {
			for (let i = 0; i < 4; i++) {
				const next = await iterator.next();
				if (next.done) break;
				frames.push(unwrapFrame(next.value));
			}
		} finally {
			await iterator.return?.(undefined);
		}

		expect(frames.map((f) => f.type)).to.deep.equal([
			'handshake',
			'announce',
			'announce',
			'system.gap',
		]);
	});
});

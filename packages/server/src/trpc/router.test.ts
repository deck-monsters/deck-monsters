import { expect } from 'chai';
import { TRPCError } from '@trpc/server';

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
			items: [{ itemType: 'Potion' }],
			options: { presets: { aggro: ['Hit'] } },
			canHoldCard: (card: { cardType?: string }) => card.cardType !== 'Blink',
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
		};
		const game = {
			characters: {
				[USER_ID]: {
					monsters: [targetMonster, supportMonster],
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

		expect(result.monsters).to.have.length(2);
		expect(result.monsters[0]).to.include({
			name: 'Stonefang',
			type: 'Basilisk',
			inRing: true,
		});
		expect(result.unequippedDeck).to.deep.equal(['Blink']);
		expect(result.cardCompatibility).to.deep.equal({
			Blink: ['Mirebell'],
		});
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
				ring: { nextFightAt: null, nextBossSpawnAt: null, contestants: [] },
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
				ring: { nextFightAt: null, nextBossSpawnAt: null, contestants: [] },
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
				ring: { nextFightAt: null, nextBossSpawnAt: null, contestants: [] },
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

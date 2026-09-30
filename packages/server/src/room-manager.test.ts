import { expect } from 'chai';
import sinon from 'sinon';
import { Game } from '@deck-monsters/engine';
import { TRPCError } from '@trpc/server';

import { RoomManager } from './room-manager.js';
import { roomStateGenerationDrops, roomStateSaveFailures, roomStateSource } from './metrics/index.js';

// ---- Drizzle stub helpers ----

/**
 * Returns a Drizzle-style select chain stub that resolves to `result`.
 *
 * Supports both terminal chains:
 *   .from().where()           (listRoomsForUser, assertMember)
 *   .from().where().limit()   (most queries)
 *   .from().innerJoin().where() (listRoomsForUser join)
 *
 * The `whereResult` is a Promise extended with a `.limit` property so both
 * await patterns resolve correctly.
 */
function makeSelectChain(result: unknown[]) {
	const limitStub = sinon.stub().resolves(result);
	const orderByStub = sinon.stub().returns({ limit: limitStub });
	const whereResult = Object.assign(Promise.resolve(result), {
		limit: limitStub,
		orderBy: orderByStub,
	});
	const whereStub = sinon.stub().returns(whereResult);
	const innerJoinStub = sinon.stub().returns({ where: whereStub });
	const fromStub = sinon.stub().returns({ where: whereStub, innerJoin: innerJoinStub });
	return { from: fromStub, _orderByStub: orderByStub };
}

interface DbStubOpts {
	selectResults?: unknown[][];
}

function makeDbStub(opts: DbStubOpts = {}) {
	let idx = 0;
	const selectStub = sinon.stub().callsFake(() => {
		const result = opts.selectResults?.[idx++] ?? [];
		return makeSelectChain(result);
	});

	const valuesStub = sinon.stub().resolves([]);
	const insertStub = sinon.stub().returns({ values: valuesStub });

	const deleteWhereStub = sinon.stub().resolves([]);
	const deleteStub = sinon.stub().returns({ where: deleteWhereStub });

	const updateWhereStub = sinon.stub().callsFake(() => Object.assign(Promise.resolve([]), { returning: () => Promise.resolve([]) }));
	const updateSetStub = sinon.stub().returns({ where: updateWhereStub });
	const updateStub = sinon.stub().returns({ set: updateSetStub });

	return {
		select: selectStub,
		insert: insertStub,
		delete: deleteStub,
		update: updateStub,
		_stubs: { selectStub, valuesStub, insertStub, deleteStub, deleteWhereStub, updateStub, updateSetStub, updateWhereStub },
	};
}

// ---- Engine dep stubs ----

function makeEngineDeps() {
	const flushStateFn = sinon.stub().resolves();

	const mockEventBus = { subscribe: sinon.stub().returns(sinon.stub()) };

	// stateStore is set via a property assignment on game — track the value manually.
	let _stateStore: unknown = undefined;
	const mockGame = {
		get stateStore() { return _stateStore; },
		set stateStore(v: unknown) { _stateStore = v; },
		eventBus: mockEventBus as never,
		ring: { on: sinon.stub(), off: sinon.stub(), inEncounter: false } as never,
		options: {} as Record<string, unknown>,
		flushState: flushStateFn,
		dispose: sinon.stub(),
	};

	const GameStub = sinon.stub().callsFake((opts: Record<string, unknown>) => {
		mockGame.options = opts ?? {};
		return mockGame;
	});
	const restoreGameStub = sinon.stub().callsFake(() => {
		mockGame.options = {};
		return mockGame;
	});

	return {
		deps: {
			Game: GameStub as unknown as typeof import('@deck-monsters/engine').Game,
			restoreGame: restoreGameStub as unknown as typeof import('@deck-monsters/engine').restoreGame,
		},
		mockGame,
		mockEventBus,
		flushStateFn,
		GameStub,
		restoreGameStub,
	};
}

function held() {
	let release!: () => void;
	const promise = new Promise<void>((resolve) => { release = resolve; });
	return { promise, release };
}
const tick = () => new Promise((resolve) => setImmediate(resolve));

// ---- Constants ----

const ROOM_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const OWNER_ID = 'oooooooo-0000-0000-0000-000000000000';
const USER_ID = 'uuuuuuuu-1111-1111-1111-111111111111';
const INVITE = 'ABCD1234';

// ---- Tests ----

describe('RoomManager', () => {
	afterEach(() => sinon.restore());

	// ---- createRoom ----

	describe('createRoom', () => {
		it('inserts room and member rows, assigns stateStore, and caches the game', async () => {
			const { deps, mockGame, GameStub } = makeEngineDeps();
			const db = makeDbStub();
			const rm = new RoomManager(db as never, () => {}, deps);

			const result = await rm.createRoom(OWNER_ID, 'My Room');

			expect(result.roomId).to.be.a('string');
			expect(result.inviteCode).to.be.a('string').with.lengthOf(8);
			expect(db._stubs.insertStub.callCount).to.equal(2);
			expect(GameStub.calledOnce).to.be.true;
			expect(mockGame.stateStore).to.not.be.undefined;
		});

		it('counts an engine save failure (context game.persistState) as a failed save (bug 207)', async () => {
			const { deps, GameStub } = makeEngineDeps();
			const logged: unknown[] = [];
			const rm = new RoomManager(makeDbStub() as never, (err) => logged.push(err), deps);
			await rm.createRoom(OWNER_ID, 'My Room');
			const roomLog = GameStub.firstCall.args[1] as (err: unknown) => void;
			const failures = async () => (await roomStateSaveFailures.get()).values[0]?.value ?? 0;
			const before = await failures();

			roomLog(Object.assign(new Error('room state save failed for roomId r: circular'), { context: 'game.persistState' }));
			roomLog(new Error('unrelated'));

			expect(await failures()).to.equal(before + 1);
			expect(logged).to.have.length(2);
		});

		it('returns the cached game on subsequent getGame call (no extra DB query)', async () => {
			const { deps, mockGame } = makeEngineDeps();
			const db = makeDbStub();
			const rm = new RoomManager(db as never, () => {}, deps);

			const { roomId } = await rm.createRoom(OWNER_ID, 'Room');
			const game = await rm.getGame(roomId);

			expect(game).to.equal(mockGame);
			// select should not have been called (cache hit)
			expect(db._stubs.selectStub.called).to.be.false;
		});
	});

	// ---- joinRoom ----

	describe('joinRoom', () => {
		it('finds room by invite code and inserts member', async () => {
			const db = makeDbStub({
				selectResults: [
					[{ id: ROOM_ID }],   // invite code lookup
					[],                  // existing membership check — none
				],
			});
			const { deps } = makeEngineDeps();
			const rm = new RoomManager(db as never, () => {}, deps);

			const result = await rm.joinRoom(USER_ID, INVITE);

			expect(result).to.deep.equal({ roomId: ROOM_ID });
			expect(db._stubs.insertStub.calledOnce).to.be.true;
		});

		it('skips insert when user is already a member', async () => {
			const db = makeDbStub({
				selectResults: [
					[{ id: ROOM_ID }],
					[{ roomId: ROOM_ID, userId: USER_ID }],  // already member
				],
			});
			const { deps } = makeEngineDeps();
			const rm = new RoomManager(db as never, () => {}, deps);

			await rm.joinRoom(USER_ID, INVITE);

			expect(db._stubs.insertStub.called).to.be.false;
		});

		it('throws NOT_FOUND for an invalid invite code', async () => {
			const db = makeDbStub({ selectResults: [[]] });
			const { deps } = makeEngineDeps();
			const rm = new RoomManager(db as never, () => {}, deps);

			await expect(rm.joinRoom(USER_ID, 'BADCODE')).to.be.rejectedWith(TRPCError);
		});
	});

	// ---- ensureMember ----

	describe('ensureMember', () => {
		it('inserts a member row when user is not already a member', async () => {
			const db = makeDbStub({
				selectResults: [[]], // no existing membership
			});
			const { deps } = makeEngineDeps();
			const rm = new RoomManager(db as never, () => {}, deps);

			await rm.ensureMember(USER_ID, ROOM_ID);

			expect(db._stubs.insertStub.calledOnce).to.be.true;
			expect(db._stubs.valuesStub.firstCall.args[0]).to.deep.equal({
				roomId: ROOM_ID,
				userId: USER_ID,
				role: 'member',
			});
		});

		it('is a no-op when user is already a member', async () => {
			const db = makeDbStub({
				selectResults: [[{ roomId: ROOM_ID, userId: USER_ID, role: 'owner' }]],
			});
			const { deps } = makeEngineDeps();
			const rm = new RoomManager(db as never, () => {}, deps);

			await rm.ensureMember(USER_ID, ROOM_ID);

			expect(db._stubs.insertStub.called).to.be.false;
		});
	});

	// ---- leaveRoom ----

	describe('leaveRoom', () => {
		it('deletes the member row when caller is not the owner', async () => {
			const db = makeDbStub({
				selectResults: [[{ ownerId: OWNER_ID }]],
			});
			const { deps } = makeEngineDeps();
			const rm = new RoomManager(db as never, () => {}, deps);

			await rm.leaveRoom(USER_ID, ROOM_ID);

			expect(db._stubs.deleteStub.calledOnce).to.be.true;
		});

		it('throws FORBIDDEN when the owner tries to leave', async () => {
			const db = makeDbStub({
				selectResults: [[{ ownerId: OWNER_ID }]],
			});
			const { deps } = makeEngineDeps();
			const rm = new RoomManager(db as never, () => {}, deps);

			const err = await rm.leaveRoom(OWNER_ID, ROOM_ID).catch((e: unknown) => e);
			expect(err).to.be.instanceOf(TRPCError);
			expect((err as TRPCError).code).to.equal('FORBIDDEN');
			expect(db._stubs.deleteStub.called).to.be.false;
		});
	});

	// ---- deleteRoom ----

	describe('deleteRoom', () => {
		it('deletes the DB row when caller is the owner', async () => {
			const db = makeDbStub({
				selectResults: [[{ ownerId: OWNER_ID }]],
			});
			const { deps } = makeEngineDeps();
			const rm = new RoomManager(db as never, () => {}, deps);

			await rm.deleteRoom(OWNER_ID, ROOM_ID);

			expect(db._stubs.deleteStub.calledOnce).to.be.true;
		});

		it('throws FORBIDDEN when caller is not the owner', async () => {
			const db = makeDbStub({
				selectResults: [[{ ownerId: OWNER_ID }]],
			});
			const { deps } = makeEngineDeps();
			const rm = new RoomManager(db as never, () => {}, deps);

			const err = await rm.deleteRoom(USER_ID, ROOM_ID).catch((e: unknown) => e);
			expect(err).to.be.instanceOf(TRPCError);
			expect((err as TRPCError).code).to.equal('FORBIDDEN');
			expect(db._stubs.deleteStub.called).to.be.false;
		});

		it('throws NOT_FOUND when the room does not exist', async () => {
			const db = makeDbStub({ selectResults: [[]] });
			const { deps } = makeEngineDeps();
			const rm = new RoomManager(db as never, () => {}, deps);

			const err = await rm.deleteRoom(OWNER_ID, ROOM_ID).catch((e: unknown) => e);
			expect(err).to.be.instanceOf(TRPCError);
			expect((err as TRPCError).code).to.equal('NOT_FOUND');
		});

		it('evicts the room from the active cache before deleting', async () => {
			const { deps, mockGame } = makeEngineDeps();
			// Prime the cache via createRoom
			const db = makeDbStub({
				selectResults: [[{ ownerId: OWNER_ID }]],
			});
			const rm = new RoomManager(db as never, () => {}, deps);
			const { roomId } = await rm.createRoom(OWNER_ID, 'Room');

			// Separately stub a db for the deleteRoom path that knows the owner
			const db2 = makeDbStub({
				selectResults: [[{ ownerId: OWNER_ID }]],
			});
			const rm2 = new RoomManager(db2 as never, () => {}, deps);
			// Prime cache
			(rm2 as any).active.set(roomId, {
				game: mockGame,
				eventBus: mockGame.eventBus,
				lastActivityAt: Date.now(),
				unsubscribePersister: sinon.stub(),
				unsubscribeMetrics: sinon.stub(),
				unsubscribeFightStats: sinon.stub(),
				unsubscribeFightSummary: sinon.stub(),
				unsubscribeDebugLogger: sinon.stub(),
			});

			await rm2.deleteRoom(OWNER_ID, roomId);

			// Cache should be empty — getGame would now call _getOrLoad and hit DB
			expect((rm2 as any).active.has(roomId)).to.be.false;
		});

		it('disposes the active game and detaches all subscribers exactly once', async () => {
			// Regression (#71): deleteRoom used to unsubscribe but skip game.dispose(),
			// leaving ring timers / semaphore listeners alive after the DB row was gone.
			const { deps, mockGame } = makeEngineDeps();
			const db = makeDbStub({
				selectResults: [[{ ownerId: OWNER_ID }]],
			});
			const rm = new RoomManager(db as never, () => {}, deps);

			const unsubscribePersister = sinon.stub();
			const unsubscribeMetrics = sinon.stub();
			const unsubscribeFightStats = sinon.stub();
			const unsubscribeFightSummary = sinon.stub();
			const unsubscribeDebugLogger = sinon.stub();

			(rm as any).active.set(ROOM_ID, {
				game: mockGame,
				eventBus: mockGame.eventBus,
				lastActivityAt: Date.now(),
				unsubscribePersister,
				unsubscribeMetrics,
				unsubscribeFightStats,
				unsubscribeFightSummary,
				unsubscribeDebugLogger,
			});

			await rm.deleteRoom(OWNER_ID, ROOM_ID);

			expect(unsubscribePersister.calledOnce).to.be.true;
			expect(unsubscribeMetrics.calledOnce).to.be.true;
			expect(unsubscribeFightStats.calledOnce).to.be.true;
			expect(unsubscribeFightSummary.calledOnce).to.be.true;
			expect(unsubscribeDebugLogger.calledOnce).to.be.true;
			expect(mockGame.dispose.calledOnce).to.be.true;
			expect((rm as any).active.has(ROOM_ID)).to.be.false;
		});

		it('does not resurrect a deleted room into active when delete races an in-flight load', async () => {
			// Regression (#71): _loadRoom can finish after deleteRoom removed the DB row
			// and active entry, then active.set a ghost room with live timers/subscribers.
			let releaseLoadSelect!: (rows: unknown[]) => void;
			const loadSelectPromise = new Promise<unknown[]>((resolve) => {
				releaseLoadSelect = resolve;
			});

			let selectIdx = 0;
			const selectStub = sinon.stub().callsFake(() => {
				selectIdx += 1;
				if (selectIdx === 1) {
					// _loadRoom state query — held until after deleteRoom completes
					const limitStub = sinon.stub().returns(loadSelectPromise);
					const orderByStub = sinon.stub().returns({ limit: limitStub });
					const whereResult = Object.assign(new Promise(() => {}), {
						limit: limitStub,
						orderBy: orderByStub,
					});
					const whereStub = sinon.stub().returns(whereResult);
					const fromStub = sinon.stub().returns({
						where: whereStub,
						innerJoin: sinon.stub(),
					});
					return { from: fromStub };
				}
				// deleteRoom owner lookup
				return makeSelectChain([{ ownerId: OWNER_ID }]);
			});

			const deleteWhereStub = sinon.stub().resolves([]);
			const db = {
				select: selectStub,
				insert: sinon.stub().returns({ values: sinon.stub().resolves([]) }),
				delete: sinon.stub().returns({ where: deleteWhereStub }),
				update: sinon.stub().returns({ set: sinon.stub().returns({ where: sinon.stub().resolves([]) }) }),
			};

			const { deps, mockGame, GameStub } = makeEngineDeps();
			const rm = new RoomManager(db as never, () => {}, deps);

			const loadPromise = rm.getGame(ROOM_ID);

			// getGame awaits engineReady before _loadRoom — poll until the deferred select is held.
			const deadline = Date.now() + 2000;
			while (!selectStub.called && Date.now() < deadline) {
				await new Promise((r) => setTimeout(r, 10));
			}
			expect(selectStub.calledOnce).to.be.true;

			await rm.deleteRoom(OWNER_ID, ROOM_ID);

			// Pre-delete snapshot: room still appeared to exist when the load began.
			releaseLoadSelect([{ state: null }]);

			const err = await loadPromise.catch((e: unknown) => e);
			expect(err).to.be.instanceOf(TRPCError);
			expect((err as TRPCError).code).to.equal('NOT_FOUND');
			expect((rm as any).active.has(ROOM_ID)).to.be.false;
			expect((rm as any).loading.has(ROOM_ID)).to.be.false;
			expect(GameStub.calledOnce).to.be.true;
			expect(mockGame.dispose.calledOnce).to.be.true;
		});
	});

	// ---- listRoomsForUser ----

	describe('listRoomsForUser', () => {
		it('returns mapped rows', async () => {
			const rows = [{ roomId: ROOM_ID, name: 'My Room', role: 'owner' }];
			const db = makeDbStub({ selectResults: [rows] });
			const { deps } = makeEngineDeps();
			const rm = new RoomManager(db as never, () => {}, deps);

			const result = await rm.listRoomsForUser(OWNER_ID);

			expect(result).to.deep.equal(rows);
		});
	});

	// ---- getRoomInfo ----

	describe('getRoomInfo', () => {
		it('returns roomId, name, inviteCode, memberCount, and role', async () => {
			const db = makeDbStub({
				selectResults: [
					[{ id: ROOM_ID, name: 'My Room', inviteCode: INVITE }],
					[{ value: 3 }],     // count query (Promise.all[0])
					[{ role: 'owner', lastSeenAt: null }], // member role query (Promise.all[1])
				],
			});
			const { deps } = makeEngineDeps();
			const rm = new RoomManager(db as never, () => {}, deps);

			const result = await rm.getRoomInfo(OWNER_ID, ROOM_ID);

			expect(result).to.deep.equal({
				roomId: ROOM_ID,
				name: 'My Room',
				inviteCode: INVITE,
				memberCount: 3,
				role: 'owner',
				lastSeenAt: null,
			});
		});

		it('throws NOT_FOUND for a missing room', async () => {
			const db = makeDbStub({ selectResults: [[]] });
			const { deps } = makeEngineDeps();
			const rm = new RoomManager(db as never, () => {}, deps);

			const err = await rm.getRoomInfo(OWNER_ID, ROOM_ID).catch((e: unknown) => e);
			expect(err).to.be.instanceOf(TRPCError);
			expect((err as TRPCError).code).to.equal('NOT_FOUND');
		});
	});

	// ---- assertMember ----

	describe('assertMember', () => {
		it('resolves when the user is a member', async () => {
			const db = makeDbStub({
				selectResults: [[{ roomId: ROOM_ID, userId: USER_ID }]],
			});
			const { deps } = makeEngineDeps();
			const rm = new RoomManager(db as never, () => {}, deps);

			await expect(rm.assertMember(USER_ID, ROOM_ID)).to.be.fulfilled;
		});

		it('throws FORBIDDEN when user is not a member', async () => {
			const db = makeDbStub({ selectResults: [[]] });
			const { deps } = makeEngineDeps();
			const rm = new RoomManager(db as never, () => {}, deps);

			const err = await rm.assertMember(USER_ID, ROOM_ID).catch((e: unknown) => e);
			expect(err).to.be.instanceOf(TRPCError);
			expect((err as TRPCError).code).to.equal('FORBIDDEN');
		});
	});

	/**
	 * The member list is readable by every member of the room, and `profiles.display_name`
	 * is seeded from the user's email by `handle_new_user` — so an unmasked read here
	 * broadcasts addresses exactly the way the leaderboards did (#112). See
	 * 10b-bugs-fixed.md #118.
	 */
	describe('getRoomMembers', () => {
		it('masks an email-defaulted display name', async () => {
			const db = makeDbStub({
				selectResults: [
					[
						{
							userId: USER_ID,
							displayName: 'david+leyo@brainermail.com',
							role: 'member',
							joinedAt: new Date(),
						},
					],
				],
			});
			const { deps } = makeEngineDeps();
			const rm = new RoomManager(db as never, () => {}, deps);

			const members = await rm.getRoomMembers(ROOM_ID);
			expect(members[0]!.displayName).to.equal('david');
		});

		it('leaves a chosen display name alone', async () => {
			const db = makeDbStub({
				selectResults: [
					[{ userId: USER_ID, displayName: 'Santi Brainer', role: 'member', joinedAt: new Date() }],
				],
			});
			const { deps } = makeEngineDeps();
			const rm = new RoomManager(db as never, () => {}, deps);

			const members = await rm.getRoomMembers(ROOM_ID);
			expect(members[0]!.displayName).to.equal('Santi Brainer');
		});
	});

	// ---- getGame / _getOrLoad ----

	describe('getGame', () => {
		it('restores game from state when not in cache', async () => {
			const db = makeDbStub({
				selectResults: [[{ state: 'base64gzipstate' }]],
			});
			const { deps, mockGame, restoreGameStub } = makeEngineDeps();
			const rm = new RoomManager(db as never, () => {}, deps);

			const game = await rm.getGame(ROOM_ID);

			expect(restoreGameStub.calledOnce).to.be.true;
			expect(restoreGameStub.calledWith('base64gzipstate')).to.be.true;
			expect(game).to.equal(mockGame);
		});

		it('creates a fresh Game when no state exists', async () => {
			const db = makeDbStub({
				selectResults: [[{ state: null }]],
			});
			const { deps, mockGame, GameStub, restoreGameStub } = makeEngineDeps();
			const rm = new RoomManager(db as never, () => {}, deps);

			const game = await rm.getGame(ROOM_ID);

			expect(GameStub.calledOnce).to.be.true;
			expect(restoreGameStub.called).to.be.false;
			expect(game).to.equal(mockGame);
		});

		it('returns the same game instance on repeated calls (cache hit)', async () => {
			const { deps, mockGame } = makeEngineDeps();
			const db = makeDbStub();
			const rm = new RoomManager(db as never, () => {}, deps);
			const { roomId } = await rm.createRoom(OWNER_ID, 'Room');

			const g1 = await rm.getGame(roomId);
			const g2 = await rm.getGame(roomId);

			expect(g1).to.equal(mockGame);
			expect(g2).to.equal(mockGame);
			// No select calls — both were served from cache
			expect(db._stubs.selectStub.called).to.be.false;
		});

		it('throws NOT_FOUND when room does not exist in DB', async () => {
			const db = makeDbStub({ selectResults: [[]] });
			const { deps } = makeEngineDeps();
			const rm = new RoomManager(db as never, () => {}, deps);

			const err = await rm.getGame(ROOM_ID).catch((e: unknown) => e);
			expect(err).to.be.instanceOf(TRPCError);
			expect((err as TRPCError).code).to.equal('NOT_FOUND');
		});
	});

	// ---- unloadRoom ----

	describe('unloadRoom', () => {
		it('flushes state (flushState) to flush pending writes then removes from cache', async () => {
			const { deps, flushStateFn } = makeEngineDeps();
			const db = makeDbStub();
			const rm = new RoomManager(db as never, () => {}, deps);
			const { roomId } = await rm.createRoom(OWNER_ID, 'Room');

			await rm.unloadRoom(roomId);

			expect(flushStateFn.calledOnce).to.be.true;
			expect((rm as any).active.has(roomId)).to.be.false;
		});

		it('is a no-op for a room not in the active cache', async () => {
			const { deps } = makeEngineDeps();
			const db = makeDbStub();
			const rm = new RoomManager(db as never, () => {}, deps);

			// Should not throw
			await expect(rm.unloadRoom('nonexistent-id')).to.be.fulfilled;
		});

		it('does not unload a room with a fight in progress, leaving it active for the next sweep', async () => {
			// Regression: unloading mid-fight detaches this room's event bus
			// subscribers (persister, fight-summary writer, stats) while the fight's
			// own untracked setTimeout chain keeps running — the fight's
			// announcements, stats, and summary row are silently lost.
			const { deps, mockGame, flushStateFn } = makeEngineDeps();
			const db = makeDbStub();
			const rm = new RoomManager(db as never, () => {}, deps);
			const { roomId } = await rm.createRoom(OWNER_ID, 'Room');

			(mockGame.ring as unknown as { inEncounter: boolean }).inEncounter = true;

			await rm.unloadRoom(roomId);

			expect(flushStateFn.called).to.be.false;
			expect(mockGame.dispose.called).to.be.false;
			expect((rm as any).active.has(roomId)).to.be.true;
		});
	});


	// ---- room state columns (roadmap 37 task 4) ----

	describe('state columns', () => {
		async function sourceCount(source: string): Promise<number> {
			const metric = await roomStateSource.get();
			return metric.values.find((v) => v.labels['source'] === source)?.value ?? 0;
		}

		it('restores from the jsonb state and counts the source', async () => {
			const state = { name: 'Game', options: { roomId: ROOM_ID } };
			const db = makeDbStub({ selectResults: [[{ state }]] });
			const { deps, restoreGameStub } = makeEngineDeps();
			const rm = new RoomManager(db as never, () => {}, deps);
			const before = await sourceCount('state');

			await rm.getGame(ROOM_ID);

			expect(restoreGameStub.firstCall.args[0]).to.equal(state);
			expect(await sourceCount('state')).to.equal(before + 1);
		});

		it('starts a fresh game, without writing, when the room has no state', async () => {
			// state_blob is gone (roadmap 37 contract): null state is a new or reset room.
			const db = makeDbStub({ selectResults: [[{ state: null }]] });
			const { deps, restoreGameStub, GameStub } = makeEngineDeps();
			const rm = new RoomManager(db as never, () => {}, deps);

			await rm.getGame(ROOM_ID);

			expect(restoreGameStub.called).to.be.false;
			expect(GameStub.calledOnce).to.be.true;
			expect(db._stubs.updateSetStub.called).to.be.false;
		});

		it('quarantines a failed jsonb state into quarantined_state with a new version', async () => {
			const state = { name: 'Game', options: {} };
			const db = makeDbStub({ selectResults: [[{ state }]] });
			const { deps, restoreGameStub, GameStub } = makeEngineDeps();
			restoreGameStub.throws(new Error('bad state'));
			const rm = new RoomManager(db as never, () => {}, deps);

			await rm.getGame(ROOM_ID);

			const set = db._stubs.updateSetStub.firstCall.args[0];
			expect(set.quarantinedState).to.equal(state);
			expect(set.state).to.equal(null);
			expect(set.stateVersion).to.be.greaterThan(0);
			expect(GameStub.calledOnce).to.be.true;
		});
	});

	// ---- flush races (roadmap 37 risk 3) ----

	describe('flush races', () => {

		it('a reload right after unload selects only once the flush has landed', async () => {
			const { deps, flushStateFn, mockGame, GameStub } = makeEngineDeps();
			const db = makeDbStub({ selectResults: [[{ state: null }]] });
			const rm = new RoomManager(db as never, () => {}, deps);
			const { roomId } = await rm.createRoom(OWNER_ID, 'Room');
			const write = held();
			flushStateFn.returns(write.promise);

			const fresh = { ...mockGame, dispose: sinon.stub() };
			GameStub.callsFake(() => fresh);

			const unloading = rm.unloadRoom(roomId);
			const reloading = rm.getGame(roomId);
			await tick();
			await tick();

			expect(db._stubs.selectStub.called, 'select ran before the flush settled').to.be.false;
			write.release();
			await unloading;
			// The racing getGame must build a new game, not be handed the disposed one.
			expect(await reloading).to.equal(fresh);
			expect(fresh).to.not.equal(mockGame);
			expect(db._stubs.selectStub.called).to.be.true;
		});

		it('unloadRoom does not resolve until the flush settles, but disposes the game right away', async () => {
			const { deps, flushStateFn, mockGame } = makeEngineDeps();
			const db = makeDbStub();
			const rm = new RoomManager(db as never, () => {}, deps);
			const { roomId } = await rm.createRoom(OWNER_ID, 'Room');
			const write = held();
			flushStateFn.returns(write.promise);

			let done = false;
			const unloading = rm.unloadRoom(roomId).then(() => { done = true; });
			await tick();

			expect(done).to.be.false;
			expect(mockGame.dispose.calledOnce).to.be.true;
			write.release();
			await unloading;
			expect((rm as any).pendingFlush.has(roomId)).to.be.false;
		});

		it('a reset writes the DB only after the old game flush has settled', async () => {
			const { deps, flushStateFn } = makeEngineDeps();
			const db = makeDbStub({ selectResults: [[{ state: { name: 'Game', options: {} } }]] });
			const rm = new RoomManager(db as never, () => {}, deps);
			const { roomId } = await rm.createRoom(OWNER_ID, 'Room');
			db._stubs.deleteStub.resetHistory();
			db._stubs.updateStub.resetHistory();
			const write = held();
			flushStateFn.returns(write.promise);

			const resetting = rm.resetRoomState(roomId);
			await tick();
			await tick();

			expect(db._stubs.deleteStub.called, 'stats deleted before the flush settled').to.be.false;
			expect(db._stubs.updateStub.called, 'row updated before the flush settled').to.be.false;
			write.release();
			await resetting;

			const tombstone = db._stubs.updateSetStub.lastCall.args[0];
			expect(tombstone.state).to.equal(null);
			expect(tombstone.quarantinedState).to.deep.equal({ name: 'Game', options: {} });
			expect(tombstone.stateVersion).to.be.greaterThan(0);
			expect((rm as any).active.has(roomId)).to.be.false;
		});

		it('a load issued mid-reset waits for the tombstone and builds a fresh game', async () => {
			const { deps, restoreGameStub, GameStub } = makeEngineDeps();
			const db = makeDbStub({
				selectResults: [
					[{ state: { name: 'Game', options: {} } }], // reset reads the old row
					[{ state: null }],                          // the load sees the tombstone
				],
			});
			const gate = held();
			const rm = new RoomManager(db as never, () => {}, deps);
			const { roomId } = await rm.createRoom(OWNER_ID, 'Room');
			GameStub.resetHistory();
			db._stubs.deleteWhereStub.onFirstCall().returns(gate.promise);

			const resetting = rm.resetRoomState(roomId);
			const loading = rm.getGame(roomId);
			await tick();
			await tick();
			expect(db._stubs.selectStub.called, 'load selected the pre-reset row').to.be.false;

			gate.release();
			await resetting;
			await loading;

			expect(restoreGameStub.called, 'pre-reset state was restored').to.be.false;
			expect(GameStub.calledOnce).to.be.true;
			expect((rm as any).resetting.has(roomId)).to.be.false;
		});

		it('discards a load that had already selected before the reset began', async () => {
			const { deps } = makeEngineDeps();
			const oldRow = held();
			const rows = [[{ state: { name: 'Game', options: {} } }], [{ state: { name: 'Game', options: {} } }]];
			let n = 0;
			const db = makeDbStub();
			(db as any).select = sinon.stub().callsFake(() => {
				const i = n++;
				const limit = i === 0 ? () => oldRow.promise.then(() => rows[0]) : () => Promise.resolve(rows[1]);
				const where = Object.assign(Promise.resolve(rows[i] ?? []), { limit });
				return { from: () => ({ where: () => where }) };
			});
			const rm = new RoomManager(db as never, () => {}, deps);

			const loading = rm.getGame(ROOM_ID).catch((e: unknown) => e);
			await tick();
			await rm.resetRoomState(ROOM_ID);
			oldRow.release();

			const err = await loading;
			expect(err).to.be.instanceOf(TRPCError);
			expect((err as TRPCError).code).to.equal('NOT_FOUND');
			expect((rm as any).active.has(ROOM_ID)).to.be.false;
		});
	});

	describe('load joining during a reset', () => {
		it('a getGame arriving mid-reset does not join the invalidated load and gets a fresh game', async () => {
			const { deps, GameStub } = makeEngineDeps();
			const oldRow = held();
			const row = [{ state: { name: 'Game', options: {} } }];
			let n = 0;
			const db = makeDbStub();
			(db as any).select = sinon.stub().callsFake(() => {
				const i = n++;
				const limit = i === 0 ? () => oldRow.promise.then(() => row) : () => Promise.resolve(i === 1 ? row : [{ state: null }]);
				return { from: () => ({ where: () => Object.assign(Promise.resolve([]), { limit }) }) };
			});
			const gate = held();
			db._stubs.deleteWhereStub.onFirstCall().returns(gate.promise);
			const rm = new RoomManager(db as never, () => {}, deps);

			const a = rm.getGame(ROOM_ID).catch((e: unknown) => e); // load A, select held open
			await tick();
			const resetting = rm.resetRoomState(ROOM_ID);
			const b = rm.getGame(ROOM_ID); // arrives mid-reset
			oldRow.release();
			gate.release();
			await resetting;

			expect(await a).to.be.instanceOf(TRPCError);
			const game = await b;
			expect(game).to.exist;
			expect(GameStub.called).to.be.true; // fresh game, built after the tombstone
		});
	});

	describe('room generation (bug G)', () => {
		// Load a room at generation 3 whose saves are refused, and whose generation probe reads
		// `probeGeneration` (a row that no longer exists is `null`).
		async function loadedRoom(probeGeneration: number | null) {
			const { deps, mockGame } = makeEngineDeps();
			const db = makeDbStub();
			let n = 0;
			(db as any).select = sinon.stub().callsFake(() => {
				const rows = n++ === 0
					? [{ state: { name: 'Game', options: {} }, stateGeneration: 3 }]
					: probeGeneration === null ? [] : [{ generation: probeGeneration }];
				return { from: () => ({ where: () => Object.assign(Promise.resolve(rows), { limit: () => Promise.resolve(rows) }) }) };
			});
			const returning = sinon.stub().resolves([]);
			db._stubs.updateSetStub.returns({ where: sinon.stub().returns({ returning }) });
			const rm = new RoomManager(db as never, () => {}, deps);
			await rm.getGame(ROOM_ID);
			return { rm, mockGame };
		}
		const drops = async () => (await roomStateGenerationDrops.get()).values[0]?.value ?? 0;

		it('drops its copy without flushing when a refused save finds the generation moved', async () => {
			const { rm, mockGame } = await loadedRoom(4);
			const before = await drops();
			mockGame.dispose.resetHistory();
			mockGame.flushState.resetHistory();

			await (mockGame.stateStore as { save(id: string, s: unknown): Promise<void> }).save(ROOM_ID, { name: 'Game', options: {} });

			expect((rm as any).active.has(ROOM_ID)).to.be.false;
			expect(mockGame.dispose.calledOnce).to.be.true;
			expect(mockGame.flushState.called).to.be.false;
			expect(await drops()).to.equal(before + 1);
		});

		it('keeps its copy when the refused save was merely stale (same generation) or the row is gone', async () => {
			for (const probe of [3, null]) {
				const { rm, mockGame } = await loadedRoom(probe);
				const before = await drops();
				await (mockGame.stateStore as { save(id: string, s: unknown): Promise<void> }).save(ROOM_ID, { name: 'Game', options: {} });
				expect((rm as any).active.has(ROOM_ID)).to.be.true;
				expect(await drops()).to.equal(before);
			}
		});

		it('a drop is a no-op when the active copy was replaced by a newer load', async () => {
			const { rm, mockGame } = await loadedRoom(4);
			const newer = { game: { dispose: sinon.stub() } };
			(rm as any).active.set(ROOM_ID, newer);
			const before = await drops();
			mockGame.dispose.resetHistory();

			await (mockGame.stateStore as { save(id: string, s: unknown): Promise<void> }).save(ROOM_ID, { name: 'Game', options: {} });

			expect((rm as any).active.get(ROOM_ID)).to.equal(newer);
			expect(newer.game.dispose.called).to.be.false;
			expect(mockGame.dispose.called).to.be.false;
			expect(await drops()).to.equal(before);
		});

		it('flushAll counts a copy dropped by a refused generation save as failed, not flushed', async () => {
			const { rm, mockGame } = await loadedRoom(4);
			mockGame.flushState.callsFake(() =>
				(mockGame.stateStore as { save(id: string, s: unknown): Promise<void> })
					.save(ROOM_ID, { name: 'Game', options: {} })
					.then(() => true)
			);
			expect(await rm.flushAll(1000)).to.deep.equal({ flushed: 0, failed: 1, timedOut: 0 });
		});

		it('a reset bumps the generation in the tombstone update', async () => {
			const { deps } = makeEngineDeps();
			const db = makeDbStub();
			(db as any).select = sinon.stub().callsFake(() => {
				const rows = [{ state: null }];
				return { from: () => ({ where: () => Object.assign(Promise.resolve(rows), { limit: () => Promise.resolve(rows) }) }) };
			});
			await new RoomManager(db as never, () => {}, deps).resetRoomState(ROOM_ID);
			const tombstone = db._stubs.updateSetStub.getCalls().map((c) => c.args[0]).find((v) => 'stateVersion' in v);
			expect(tombstone).to.have.property('stateGeneration');
			expect(tombstone.state).to.equal(null);
		});
	});

	describe('flushAll with a real Game', () => {
		it('counts a game whose store rejects as failed, not flushed', async () => {
			const logs: unknown[] = [];
			const game = new Game({ roomId: ROOM_ID }, (e) => logs.push(e));
			game.stateStore = { save: () => Promise.reject(new Error('db down')), load: async () => null };
			const rm = new RoomManager(makeDbStub() as never, () => {}, makeEngineDeps().deps);
			(rm as any).active.set(ROOM_ID, { game });
			try {
				expect(await rm.flushAll(1000)).to.deep.equal({ flushed: 0, failed: 1, timedOut: 0 });
			} finally {
				game.stateStore = undefined;
				game.dispose();
			}
		});
	});

	describe('flushAll', () => {
		async function twoRooms() {
			const a = makeEngineDeps();
			const rm = new RoomManager(makeDbStub() as never, () => {}, a.deps);
			await rm.createRoom(OWNER_ID, 'A');
			// A second, distinct active entry with its own flush stub.
			const flushB = sinon.stub();
			(rm as any).active.set('room-b', { game: { flushState: flushB, ring: { inEncounter: true } } });
			return { rm, flushA: a.flushStateFn, flushB };
		}

		it('awaits every active room flush, including a room in a fight, without disposing', async () => {
			const { rm, flushA, flushB } = await twoRooms();
			const gate = held();
			flushA.returns(gate.promise);
			flushB.resolves();

			let done = false;
			const p = rm.flushAll(1000).then((r) => { done = true; return r; });
			await tick();
			expect(done).to.be.false;
			gate.release();

			expect(await p).to.deep.equal({ flushed: 2, failed: 0, timedOut: 0 });
			expect((rm as any).active.size).to.equal(2);
		});

		it('abandons a hung flush at the deadline', async () => {
			const { rm, flushA, flushB } = await twoRooms();
			flushA.returns(new Promise(() => {}));
			flushB.resolves();

			expect(await rm.flushAll(20)).to.deep.equal({ flushed: 1, failed: 0, timedOut: 1 });
		});

		it('a rejecting flush does not stop the others', async () => {
			const { rm, flushA, flushB } = await twoRooms();
			flushA.rejects(new Error('write failed'));
			flushB.resolves();

			expect(await rm.flushAll(1000)).to.deep.equal({ flushed: 1, failed: 1, timedOut: 0 });
		});
	});

	// ---- sweepIdleRooms ----

	describe('sweepIdleRooms', () => {
		it('evicts rooms past the idle threshold (threshold = -1 always matches)', async () => {
			const { deps, flushStateFn } = makeEngineDeps();
			const db = makeDbStub();
			const rm = new RoomManager(db as never, () => {}, deps);
			const { roomId } = await rm.createRoom(OWNER_ID, 'Room');

			await rm.sweepIdleRooms(-1);

			expect(flushStateFn.calledOnce).to.be.true;
			expect((rm as any).active.has(roomId)).to.be.false;
		});

		it('keeps rooms within the idle threshold', async () => {
			const { deps, flushStateFn } = makeEngineDeps();
			const db = makeDbStub();
			const rm = new RoomManager(db as never, () => {}, deps);
			await rm.createRoom(OWNER_ID, 'Room');

			// 24-hour threshold — freshly created room should survive
			await rm.sweepIdleRooms(24 * 60 * 60 * 1000);

			expect(flushStateFn.called).to.be.false;
		});

		it('evicts only rooms past the threshold when multiple rooms exist', async () => {
			const { deps, flushStateFn } = makeEngineDeps();
			const db = makeDbStub();
			const rm = new RoomManager(db as never, () => {}, deps);

			const { roomId: roomA } = await rm.createRoom(OWNER_ID, 'Room A');
			const { roomId: roomB } = await rm.createRoom(OWNER_ID, 'Room B');

			// Backdate Room A to look stale
			(rm as any).active.get(roomA).lastActivityAt = Date.now() - 1000;

			// Threshold of 500ms — Room A (1000ms old) is stale, Room B is fresh
			await rm.sweepIdleRooms(500);

			expect((rm as any).active.has(roomA)).to.be.false;
			expect((rm as any).active.has(roomB)).to.be.true;
			expect(flushStateFn.calledOnce).to.be.true;
		});
	});

	describe('getEventsSinceForRingFeed', () => {
		const memberRow = [{ roomId: ROOM_ID, userId: USER_ID, role: 'member' }];

		const sampleEventRow = (overrides: Partial<{
			id: number;
			eventId: string | null;
			scope: string;
			targetUserId: string | null;
			type: string;
			text: string;
			payload: Record<string, unknown>;
		}> = {}) => ({
			id: overrides.id ?? 10,
			roomId: ROOM_ID,
			type: overrides.type ?? 'announce',
			scope: overrides.scope ?? 'public',
			targetUserId: overrides.targetUserId ?? null,
			payload: overrides.payload ?? {},
			text: overrides.text ?? 'hi',
			eventId: overrides.eventId ?? '2000-aaaaaaaa',
			createdAt: new Date(),
		});

		it('uses id > anchor when anchor row exists', async () => {
			const anchor = [{ id: 5 }];
			const replay = [
				sampleEventRow({ id: 6, eventId: '2001-bbbbbbbb', text: 'after' }),
			];
			const db = makeDbStub({ selectResults: [memberRow, anchor, replay] });
			const { deps } = makeEngineDeps();
			const rm = new RoomManager(db as never, () => {}, deps);

			const { events } = await rm.getEventsSinceForRingFeed(USER_ID, ROOM_ID, '1999-anchor', 500);

			expect(events).to.have.length(1);
			expect(events[0]!.text).to.equal('after');
			expect(events[0]!.id).to.equal('2001-bbbbbbbb');
		});

		it('queries by event_id > lastEventId when anchor is missing (24h window)', async () => {
			const replay = [
				sampleEventRow({ id: 2, eventId: '2001-bbbbbbbb' }),
			];
			const db = makeDbStub({ selectResults: [memberRow, [], replay] });
			const { deps } = makeEngineDeps();
			const rm = new RoomManager(db as never, () => {}, deps);

			const { events } = await rm.getEventsSinceForRingFeed(USER_ID, ROOM_ID, '2000-aaaaaaaa', 500);

			expect(events).to.have.length(1);
			expect(events[0]!.id).to.equal('2001-bbbbbbbb');
		});

		it('falls back to 7d window with event_id filter when 24h returns nothing', async () => {
			const replay = [
				sampleEventRow({ id: 3, eventId: '1999-olddddd' }),
			];
			const db = makeDbStub({ selectResults: [memberRow, [], [], replay] });
			const { deps } = makeEngineDeps();
			const rm = new RoomManager(db as never, () => {}, deps);

			const { events } = await rm.getEventsSinceForRingFeed(USER_ID, ROOM_ID, '1998-cursorrr', 500);

			expect(events).to.have.length(1);
			expect(events[0]!.id).to.equal('1999-olddddd');
		});

		it('includes private events only for the requesting user', async () => {
			const replay = [
				sampleEventRow({
					id: 7,
					eventId: '2002-cccccccc',
					scope: 'private',
					targetUserId: USER_ID,
					text: 'dm',
				}),
			];
			const db = makeDbStub({ selectResults: [memberRow, [], replay] });
			const { deps } = makeEngineDeps();
			const rm = new RoomManager(db as never, () => {}, deps);

			const { events } = await rm.getEventsSinceForRingFeed(USER_ID, ROOM_ID, '2000-aaaaaaaa', 500);

			expect(events).to.have.length(1);
			expect(events[0]!.scope).to.equal('private');
			expect(events[0]!.targetUserId).to.equal(USER_ID);
		});

		it('paginates past a full first page, advancing the cursor to the last returned id', async () => {
			// Regression (review of #16/#17): a single fixed-limit query silently
			// dropped everything past the first page for long absences.
			const db = makeDbStub({ selectResults: [memberRow] });
			const { deps } = makeEngineDeps();
			const rm = new RoomManager(db as never, () => {}, deps);

			const page = (ids: string[]) =>
				ids.map((id) => ({ id, type: 'announce', scope: 'public', text: id, payload: {}, timestamp: 1 }));
			const cursors: string[] = [];
			const pages = [page(['2001-a', '2002-b']), page(['2003-c', '2004-d']), page(['2005-e'])];
			sinon.stub(rm, '_fetchRingFeedPage').callsFake(async (_u, _r, cursor: string) => {
				cursors.push(cursor);
				return pages.shift() as never;
			});

			const { events, limitReached } = await rm.getEventsSinceForRingFeed(
				USER_ID,
				ROOM_ID,
				'2000-cursor',
				2,
				100
			);

			expect(events.map((e) => e.id)).to.deep.equal(['2001-a', '2002-b', '2003-c', '2004-d', '2005-e']);
			expect(limitReached).to.equal(false);
			// Each subsequent page anchors on the previous page's last event id.
			expect(cursors).to.deep.equal(['2000-cursor', '2002-b', '2004-d']);
		});

		it('reports limitReached when the total cap is hit with rows still remaining', async () => {
			const db = makeDbStub({ selectResults: [memberRow] });
			const { deps } = makeEngineDeps();
			const rm = new RoomManager(db as never, () => {}, deps);

			const fullPage = (prefix: string) =>
				[1, 2].map((n) => ({ id: `${prefix}-${n}`, type: 'announce', scope: 'public', text: '', payload: {}, timestamp: 1 }));
			sinon.stub(rm, '_fetchRingFeedPage').callsFake(async () => fullPage(String(Date.now())) as never);

			const { events, limitReached } = await rm.getEventsSinceForRingFeed(
				USER_ID,
				ROOM_ID,
				'2000-cursor',
				2,
				4
			);

			expect(events).to.have.length(4);
			expect(limitReached).to.equal(true);
		});

		it('limitReached is false when the replay contains exactly maxTotal events and no additional row exists', async () => {
			// Off-by-one regression (#43): the old code returned limitReached:true whenever
			// total events reached the cap AND the last page was full, even if the DB had no
			// further rows. The fix probes for one more row before deciding.
			const db = makeDbStub({ selectResults: [memberRow] });
			const { deps } = makeEngineDeps();
			const rm = new RoomManager(db as never, () => {}, deps);

			const makeEvent = (id: string) =>
				({ id, type: 'announce', scope: 'public', text: '', payload: {}, timestamp: 1 });

			const probeCalls: { cursor: string; limit: number }[] = [];
			sinon.stub(rm, '_fetchRingFeedPage').callsFake(
				async (_u: string, _r: string, cursor: string, limit: number) => {
					probeCalls.push({ cursor, limit });
					if (cursor === '2000-cursor') return [makeEvent('2001-a'), makeEvent('2002-b')] as never;
					if (cursor === '2002-b') return [makeEvent('2003-c'), makeEvent('2004-d')] as never;
					// Probe after cap — nothing more in DB
					return [] as never;
				}
			);

			const { events, limitReached } = await rm.getEventsSinceForRingFeed(
				USER_ID,
				ROOM_ID,
				'2000-cursor',
				2,   // pageSize
				4    // maxTotal — exactly 4 events exist
			);

			expect(events).to.have.length(4);
			expect(limitReached).to.equal(false);
			// The probe must target the last event in the final page with limit=1
			const probeCall = probeCalls[probeCalls.length - 1]!;
			expect(probeCall).to.deep.equal({ cursor: '2004-d', limit: 1 });
		});

		it('limitReached is true when cap+1 events exist (probe finds one more row)', async () => {
			// Companion to the exactly-at-cap case: when there IS a row beyond the cap,
			// limitReached must be true and the extra event must NOT appear in the output.
			const db = makeDbStub({ selectResults: [memberRow] });
			const { deps } = makeEngineDeps();
			const rm = new RoomManager(db as never, () => {}, deps);

			const makeEvent = (id: string) =>
				({ id, type: 'announce', scope: 'public', text: '', payload: {}, timestamp: 1 });

			sinon.stub(rm, '_fetchRingFeedPage').callsFake(
				async (_u: string, _r: string, cursor: string, limit: number) => {
					if (cursor === '2000-cursor') return [makeEvent('2001-a'), makeEvent('2002-b')] as never;
					if (cursor === '2002-b') return [makeEvent('2003-c'), makeEvent('2004-d')] as never;
					// Probe: one more row exists beyond the cap
					if (cursor === '2004-d' && limit === 1) return [makeEvent('2005-e')] as never;
					return [] as never;
				}
			);

			const { events, limitReached } = await rm.getEventsSinceForRingFeed(
				USER_ID,
				ROOM_ID,
				'2000-cursor',
				2,   // pageSize
				4    // maxTotal
			);

			expect(events).to.have.length(4);
			expect(limitReached).to.equal(true);
			// The probe event must NOT appear in the output
			expect(events.map((e) => e.id)).to.not.include('2005-e');
		});
	});
});

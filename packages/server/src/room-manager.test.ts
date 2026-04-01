import { expect } from 'chai';
import sinon from 'sinon';
import { TRPCError } from '@trpc/server';

import { RoomManager } from './room-manager.js';

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
	const whereResult = Object.assign(Promise.resolve(result), { limit: limitStub });
	const whereStub = sinon.stub().returns(whereResult);
	const innerJoinStub = sinon.stub().returns({ where: whereStub });
	const fromStub = sinon.stub().returns({ where: whereStub, innerJoin: innerJoinStub });
	return { from: fromStub };
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

	return {
		select: selectStub,
		insert: insertStub,
		delete: deleteStub,
		_stubs: { selectStub, valuesStub, insertStub, deleteStub, deleteWhereStub },
	};
}

// ---- Engine dep stubs ----

function makeEngineDeps() {
	const saveStateFn = sinon.stub();

	const mockEventBus = { subscribe: sinon.stub() };

	// stateStore is set via a property assignment on game — track the value manually.
	let _stateStore: unknown = undefined;
	const mockGame = {
		get stateStore() { return _stateStore; },
		set stateStore(v: unknown) { _stateStore = v; },
		eventBus: mockEventBus as any,
		options: {} as Record<string, unknown>,
		// saveState getter mirrors the real Game implementation
		get saveState() { return saveStateFn; },
	};

	const GameStub = sinon.stub().callsFake((opts: Record<string, unknown>) => {
		mockGame.options = opts ?? {};
		return mockGame;
	});
	const restoreGameStub = sinon.stub().callsFake((_blob: string) => {
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
		saveStateFn,
		GameStub,
		restoreGameStub,
	};
}

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
			(rm2 as any).active.set(roomId, { game: mockGame, eventBus: mockGame.eventBus, lastActivityAt: Date.now() });

			await rm2.deleteRoom(OWNER_ID, roomId);

			// Cache should be empty — getGame would now call _getOrLoad and hit DB
			expect((rm2 as any).active.has(roomId)).to.be.false;
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
		it('returns roomId, name, inviteCode, and memberCount', async () => {
			const db = makeDbStub({
				selectResults: [
					[{ id: ROOM_ID, name: 'My Room', inviteCode: INVITE }],
					[{ value: 3 }],  // count query
				],
			});
			const { deps } = makeEngineDeps();
			const rm = new RoomManager(db as never, () => {}, deps);

			const result = await rm.getRoomInfo(ROOM_ID);

			expect(result).to.deep.equal({
				roomId: ROOM_ID,
				name: 'My Room',
				inviteCode: INVITE,
				memberCount: 3,
			});
		});

		it('throws NOT_FOUND for a missing room', async () => {
			const db = makeDbStub({ selectResults: [[]] });
			const { deps } = makeEngineDeps();
			const rm = new RoomManager(db as never, () => {}, deps);

			const err = await rm.getRoomInfo(ROOM_ID).catch((e: unknown) => e);
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

	// ---- getGame / _getOrLoad ----

	describe('getGame', () => {
		it('restores game from stateBlob when not in cache', async () => {
			const db = makeDbStub({
				selectResults: [[{ stateBlob: 'base64gzipstate' }]],
			});
			const { deps, mockGame, restoreGameStub } = makeEngineDeps();
			const rm = new RoomManager(db as never, () => {}, deps);

			const game = await rm.getGame(ROOM_ID);

			expect(restoreGameStub.calledOnce).to.be.true;
			expect(restoreGameStub.calledWith('base64gzipstate')).to.be.true;
			expect(game).to.equal(mockGame);
		});

		it('creates a fresh Game when no stateBlob exists', async () => {
			const db = makeDbStub({
				selectResults: [[{ stateBlob: null }]],
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
		it('calls saveState to flush pending writes then removes from cache', async () => {
			const { deps, saveStateFn } = makeEngineDeps();
			const db = makeDbStub();
			const rm = new RoomManager(db as never, () => {}, deps);
			const { roomId } = await rm.createRoom(OWNER_ID, 'Room');

			await rm.unloadRoom(roomId);

			expect(saveStateFn.calledOnce).to.be.true;
			expect((rm as any).active.has(roomId)).to.be.false;
		});

		it('is a no-op for a room not in the active cache', async () => {
			const { deps } = makeEngineDeps();
			const db = makeDbStub();
			const rm = new RoomManager(db as never, () => {}, deps);

			// Should not throw
			await expect(rm.unloadRoom('nonexistent-id')).to.be.fulfilled;
		});
	});

	// ---- sweepIdleRooms ----

	describe('sweepIdleRooms', () => {
		it('evicts rooms past the idle threshold (threshold = -1 always matches)', async () => {
			const { deps, saveStateFn } = makeEngineDeps();
			const db = makeDbStub();
			const rm = new RoomManager(db as never, () => {}, deps);
			const { roomId } = await rm.createRoom(OWNER_ID, 'Room');

			await rm.sweepIdleRooms(-1);

			expect(saveStateFn.calledOnce).to.be.true;
			expect((rm as any).active.has(roomId)).to.be.false;
		});

		it('keeps rooms within the idle threshold', async () => {
			const { deps, saveStateFn } = makeEngineDeps();
			const db = makeDbStub();
			const rm = new RoomManager(db as never, () => {}, deps);
			await rm.createRoom(OWNER_ID, 'Room');

			// 24-hour threshold — freshly created room should survive
			await rm.sweepIdleRooms(24 * 60 * 60 * 1000);

			expect(saveStateFn.called).to.be.false;
		});

		it('evicts only rooms past the threshold when multiple rooms exist', async () => {
			const { deps, saveStateFn } = makeEngineDeps();
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
			expect(saveStateFn.calledOnce).to.be.true;
		});
	});
});

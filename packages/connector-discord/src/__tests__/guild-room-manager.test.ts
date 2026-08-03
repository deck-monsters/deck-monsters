import { expect } from 'chai';
import sinon from 'sinon';
import { GuildRoomManager } from '../guild-room-manager.js';

// ---------------------------------------------------------------------------
// Drizzle stub helpers (mirrors the pattern used in packages/server tests)
// ---------------------------------------------------------------------------

function makeSelectChain(result: unknown[]) {
	const limitStub = sinon.stub().resolves(result);
	const whereResult = Object.assign(Promise.resolve(result), { limit: limitStub });
	const whereStub = sinon.stub().returns(whereResult);
	// Support chained joins: from().innerJoin().innerJoin().where()
	const joinTarget: { where: sinon.SinonStub; innerJoin: sinon.SinonStub } = {
		where: whereStub,
		innerJoin: sinon.stub(),
	};
	joinTarget.innerJoin.returns(joinTarget);
	const fromStub = sinon.stub().returns({ where: whereStub, innerJoin: joinTarget.innerJoin });
	return { from: fromStub };
}

function makeUniqueViolation(detail = 'Key (guild_id)=(g) already exists.') {
	return Object.assign(new Error(`duplicate key value violates unique constraint`), {
		code: '23505',
		detail,
	});
}

function makeDbStub(selectResultsQueue: unknown[][] = [], opts: { insertRejects?: unknown[] } = {}) {
	let idx = 0;
	const selectStub = sinon.stub().callsFake(() => {
		const result = selectResultsQueue[idx++] ?? [];
		return makeSelectChain(result);
	});

	let insertCall = 0;
	const onConflictDoUpdateStub = sinon.stub().resolves([]);
	const valuesStub = sinon.stub().callsFake(() => {
		const rejectWith = opts.insertRejects?.[insertCall++];
		if (rejectWith !== undefined) {
			const rejected = Promise.reject(rejectWith) as Promise<unknown> & {
				onConflictDoUpdate: sinon.SinonStub;
			};
			rejected.onConflictDoUpdate = onConflictDoUpdateStub;
			return rejected;
		}
		const resolved = Object.assign(Promise.resolve([]), {
			onConflictDoUpdate: onConflictDoUpdateStub,
		});
		return resolved;
	});
	const insertStub = sinon.stub().returns({ values: valuesStub });

	const setStub = sinon.stub().returns({ where: sinon.stub().resolves([]) });
	const updateStub = sinon.stub().returns({ set: setStub });

	return {
		select: selectStub,
		insert: insertStub,
		update: updateStub,
		_stubs: { selectStub, valuesStub, insertStub, updateStub, onConflictDoUpdateStub },
	};
}

function makeRoomManagerStub(roomId = 'room-abc', inviteCode = 'INV12345') {
	return {
		createRoom: sinon.stub().resolves({ roomId, inviteCode }),
		joinRoom: sinon.stub().resolves({ roomId }),
		ensureMember: sinon.stub().resolves(),
		deleteRoom: sinon.stub().resolves(),
	};
}

// ---------------------------------------------------------------------------

describe('GuildRoomManager', () => {
	afterEach(() => sinon.restore());

	describe('getOrCreateDefaultRoom', () => {
		it('returns existing room when guild_rooms row already exists', async () => {
			const db = makeDbStub([[{ roomId: 'existing-room' }]]);
			const rm = makeRoomManagerStub();

			const mgr = new GuildRoomManager(db as any, rm as any);
			const result = await mgr.getOrCreateDefaultRoom('guild-1', 'user-1');

			expect(result).to.equal('existing-room');
			expect(rm.createRoom.called).to.be.false;
			expect(rm.ensureMember.calledOnceWith('user-1', 'existing-room')).to.be.true;
		});

		it('creates a room and inserts guild_rooms row when none exists', async () => {
			// First select returns empty (no existing row)
			const db = makeDbStub([[]]);
			const rm = makeRoomManagerStub('new-room-id', 'CODE0001');

			const mgr = new GuildRoomManager(db as any, rm as any);
			const result = await mgr.getOrCreateDefaultRoom('guild-2', 'user-1');

			expect(result).to.equal('new-room-id');
			expect(rm.createRoom.calledOnce).to.be.true;
			expect(rm.createRoom.calledWith('user-1', 'Guild guild-2')).to.be.true;
			expect(db.insert.calledOnce).to.be.true;
			expect(rm.ensureMember.calledOnceWith('user-1', 'new-room-id')).to.be.true;
			expect(rm.deleteRoom.called).to.be.false;

			const insertedValues = db._stubs.valuesStub.firstCall.args[0];
			expect(insertedValues.guildId).to.equal('guild-2');
			expect(insertedValues.roomId).to.equal('new-room-id');
			expect(insertedValues.isDefault).to.be.true;
		});

		it('on unique default race: returns winner and deletes orphan via RoomManager', async () => {
			// 1) no existing default
			// 2) after unique violation, re-select finds the winning default
			const db = makeDbStub([[], [{ roomId: 'winner-room' }]], {
				insertRejects: [makeUniqueViolation()],
			});
			const rm = makeRoomManagerStub('orphan-room', 'ORPHAN01');

			const mgr = new GuildRoomManager(db as any, rm as any);
			const result = await mgr.getOrCreateDefaultRoom('guild-race', 'user-loser');

			expect(result).to.equal('winner-room');
			expect(rm.createRoom.calledOnceWith('user-loser', 'Guild guild-race')).to.be.true;
			expect(rm.deleteRoom.calledOnceWith('user-loser', 'orphan-room')).to.be.true;
			expect(rm.ensureMember.calledOnceWith('user-loser', 'winner-room')).to.be.true;
		});
	});

	describe('createSubRoom', () => {
		it('creates a room and inserts a non-default guild_rooms row', async () => {
			const db = makeDbStub();
			const rm = makeRoomManagerStub('sub-room-id', 'SUBCODE1');

			const mgr = new GuildRoomManager(db as any, rm as any);
			const result = await mgr.createSubRoom('guild-3', 'owner-id', 'Friends Room');

			expect(result.roomId).to.equal('sub-room-id');
			expect(result.inviteCode).to.equal('SUBCODE1');
			expect(rm.createRoom.calledWith('owner-id', 'Friends Room')).to.be.true;

			const insertedValues = db._stubs.valuesStub.firstCall.args[0];
			expect(insertedValues.isDefault).to.be.false;
		});

		it('selects the new room as the user active room for the guild', async () => {
			const db = makeDbStub();
			const rm = makeRoomManagerStub('sub-room-id', 'SUBCODE1');

			const mgr = new GuildRoomManager(db as any, rm as any);
			await mgr.createSubRoom('guild-3', 'owner-id', 'Friends Room');

			// guild_rooms insert + active-room upsert
			expect(db.insert.calledTwice).to.be.true;
			const activeValues = db._stubs.valuesStub.secondCall.args[0];
			expect(activeValues).to.include({
				guildId: 'guild-3',
				userId: 'owner-id',
				roomId: 'sub-room-id',
			});
			expect(db._stubs.onConflictDoUpdateStub.calledOnce).to.be.true;
		});
	});

	describe('listGuildRooms', () => {
		it('returns all rooms for a guild', async () => {
			const rows = [
				{ roomId: 'r1', isDefault: true, channelId: null },
				{ roomId: 'r2', isDefault: false, channelId: 'ch-123' },
			];
			const db = makeDbStub([rows]);
			const rm = makeRoomManagerStub();

			const mgr = new GuildRoomManager(db as any, rm as any);
			const result = await mgr.listGuildRooms('guild-4');

			expect(result).to.deep.equal(rows);
		});
	});

	describe('setAnnouncementChannel', () => {
		it('calls db.update with the correct channel ID', async () => {
			const db = makeDbStub();
			const rm = makeRoomManagerStub();

			const mgr = new GuildRoomManager(db as any, rm as any);
			await mgr.setAnnouncementChannel('guild-5', 'room-1', 'discord-ch-99');

			expect(db.update.calledOnce).to.be.true;
			const setArgs = db._stubs.updateStub.returnValues[0].set.firstCall?.args[0];
			expect(setArgs?.channelId).to.equal('discord-ch-99');
		});
	});

	describe('getAnnouncementChannel', () => {
		it('returns null when no channel is set', async () => {
			const db = makeDbStub([[{ channelId: null }]]);
			const rm = makeRoomManagerStub();

			const mgr = new GuildRoomManager(db as any, rm as any);
			const result = await mgr.getAnnouncementChannel('guild-6');

			expect(result).to.be.null;
		});

		it('returns the channel ID when set', async () => {
			const db = makeDbStub([[{ channelId: 'ch-55' }]]);
			const rm = makeRoomManagerStub();

			const mgr = new GuildRoomManager(db as any, rm as any);
			const result = await mgr.getAnnouncementChannel('guild-7');

			expect(result).to.equal('ch-55');
		});
	});

	describe('joinRoomByCode', () => {
		it('joins, ensures guild mapping, and selects the room as active', async () => {
			// select: existing guild_rooms mapping for (guild, room)
			const db = makeDbStub([[{ roomId: 'joined-room' }]]);
			const rm = makeRoomManagerStub('joined-room');

			const mgr = new GuildRoomManager(db as any, rm as any);
			const result = await mgr.joinRoomByCode('guild-1', 'user-1', 'INVITE1');

			expect(result.roomId).to.equal('joined-room');
			expect(rm.joinRoom.calledWith('user-1', 'INVITE1')).to.be.true;
			// active-room upsert
			expect(db.insert.calledOnce).to.be.true;
			const activeValues = db._stubs.valuesStub.firstCall.args[0];
			expect(activeValues).to.include({
				guildId: 'guild-1',
				userId: 'user-1',
				roomId: 'joined-room',
			});
		});

		it('inserts a non-default guild_rooms row when the joined room is not yet mapped', async () => {
			// no existing guild mapping
			const db = makeDbStub([[]]);
			const rm = makeRoomManagerStub('joined-room');

			const mgr = new GuildRoomManager(db as any, rm as any);
			await mgr.joinRoomByCode('guild-1', 'user-1', 'INVITE1');

			// guild_rooms insert + active-room upsert
			expect(db.insert.calledTwice).to.be.true;
			const guildValues = db._stubs.valuesStub.firstCall.args[0];
			expect(guildValues).to.include({
				guildId: 'guild-1',
				roomId: 'joined-room',
				isDefault: false,
			});
		});
	});

	describe('resolveRoomForUser', () => {
		it('returns validated active room when guild mapping and membership hold', async () => {
			const db = makeDbStub([[{ roomId: 'active-room' }]]);
			const rm = makeRoomManagerStub();

			const mgr = new GuildRoomManager(db as any, rm as any);
			const result = await mgr.resolveRoomForUser('guild-1', 'user-1');

			expect(result).to.equal('active-room');
			expect(rm.createRoom.called).to.be.false;
			expect(rm.ensureMember.called).to.be.false;
		});

		it('falls back to guild default and repairs active mapping when membership is stale', async () => {
			// 1) validated active select → empty (stale / left / unmapped)
			// 2) default room select → existing default
			const db = makeDbStub([[], [{ roomId: 'default-room' }]]);
			const rm = makeRoomManagerStub();

			const mgr = new GuildRoomManager(db as any, rm as any);
			const result = await mgr.resolveRoomForUser('guild-1', 'user-1');

			expect(result).to.equal('default-room');
			expect(rm.ensureMember.calledOnceWith('user-1', 'default-room')).to.be.true;
			// repair: upsert active → default
			expect(db.insert.calledOnce).to.be.true;
			const activeValues = db._stubs.valuesStub.firstCall.args[0];
			expect(activeValues).to.include({
				guildId: 'guild-1',
				userId: 'user-1',
				roomId: 'default-room',
			});
			expect(db._stubs.onConflictDoUpdateStub.calledOnce).to.be.true;
		});
	});

	describe('setActiveRoom', () => {
		it('upserts (guildId, userId) → roomId', async () => {
			const db = makeDbStub();
			const rm = makeRoomManagerStub();

			const mgr = new GuildRoomManager(db as any, rm as any);
			await mgr.setActiveRoom('guild-9', 'user-9', 'room-9');

			expect(db.insert.calledOnce).to.be.true;
			expect(db._stubs.valuesStub.firstCall.args[0]).to.include({
				guildId: 'guild-9',
				userId: 'user-9',
				roomId: 'room-9',
			});
			expect(db._stubs.onConflictDoUpdateStub.calledOnce).to.be.true;
		});
	});
});

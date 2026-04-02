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
	const innerJoinStub = sinon.stub().returns({ where: whereStub });
	const fromStub = sinon.stub().returns({ where: whereStub, innerJoin: innerJoinStub });
	return { from: fromStub };
}

function makeDbStub(selectResultsQueue: unknown[][] = []) {
	let idx = 0;
	const selectStub = sinon.stub().callsFake(() => {
		const result = selectResultsQueue[idx++] ?? [];
		return makeSelectChain(result);
	});

	const valuesStub = sinon.stub().resolves([]);
	const insertStub = sinon.stub().returns({ values: valuesStub });

	const setStub = sinon.stub().returns({ where: sinon.stub().resolves([]) });
	const updateStub = sinon.stub().returns({ set: setStub });

	return {
		select: selectStub,
		insert: insertStub,
		update: updateStub,
		_stubs: { selectStub, valuesStub, insertStub, updateStub },
	};
}

function makeRoomManagerStub(roomId = 'room-abc', inviteCode = 'INV12345') {
	return {
		createRoom: sinon.stub().resolves({ roomId, inviteCode }),
		joinRoom: sinon.stub().resolves({ roomId }),
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
			const result = await mgr.getOrCreateDefaultRoom('guild-1', 'bot-user');

			expect(result).to.equal('existing-room');
			expect(rm.createRoom.called).to.be.false;
		});

		it('creates a room and inserts guild_rooms row when none exists', async () => {
			// First select returns empty (no existing row)
			const db = makeDbStub([[]]);
			const rm = makeRoomManagerStub('new-room-id', 'CODE0001');

			const mgr = new GuildRoomManager(db as any, rm as any);
			const result = await mgr.getOrCreateDefaultRoom('guild-2', 'bot-user');

			expect(result).to.equal('new-room-id');
			expect(rm.createRoom.calledOnce).to.be.true;
			expect(db.insert.calledOnce).to.be.true;

			const insertedValues = db._stubs.valuesStub.firstCall.args[0];
			expect(insertedValues.guildId).to.equal('guild-2');
			expect(insertedValues.roomId).to.equal('new-room-id');
			expect(insertedValues.isDefault).to.be.true;
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
		it('delegates to roomManager.joinRoom', async () => {
			const db = makeDbStub();
			const rm = makeRoomManagerStub('joined-room');

			const mgr = new GuildRoomManager(db as any, rm as any);
			const result = await mgr.joinRoomByCode('user-1', 'INVITE1');

			expect(result.roomId).to.equal('joined-room');
			expect(rm.joinRoom.calledWith('user-1', 'INVITE1')).to.be.true;
		});
	});
});

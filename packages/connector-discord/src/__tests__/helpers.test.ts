import { expect } from 'chai';
import sinon from 'sinon';
import { resolveUser, resolveConnectorUserId } from '../slash-commands/helpers.js';

function makeSelectChain(result: unknown[]) {
	const limitStub = sinon.stub().resolves(result);
	const whereResult = Object.assign(Promise.resolve(result), { limit: limitStub });
	const whereStub = sinon.stub().returns(whereResult);
	const fromStub = sinon.stub().returns({ where: whereStub });
	return { from: fromStub };
}

describe('resolveUser / resolveConnectorUserId', () => {
	afterEach(() => sinon.restore());

	it('resolveUser resolves the guild/user active room (not always the default)', async () => {
		const db = {
			select: sinon.stub().callsFake(() => makeSelectChain([{ userId: 'supabase-user-1' }])),
		};

		const guildRoomManager = {
			resolveRoomForUser: sinon.stub().resolves('active-sub-room'),
			getOrCreateDefaultRoom: sinon.stub().resolves('default-room'),
		};

		const interaction = {
			user: { id: 'discord-snowflake-1', username: 'Alice' },
			guildId: 'guild-abc',
			channelId: 'channel-1',
		};

		const ctx = {
			db: db as any,
			guildRoomManager: guildRoomManager as any,
			roomManager: {} as any,
			bot: {} as any,
		};

		const result = await resolveUser(interaction as any, ctx as any);

		expect(result.supabaseUserId).to.equal('supabase-user-1');
		expect(result.roomId).to.equal('active-sub-room');
		expect(guildRoomManager.resolveRoomForUser.calledOnceWith('guild-abc', 'supabase-user-1')).to
			.be.true;
		expect(guildRoomManager.getOrCreateDefaultRoom.called).to.be.false;
	});

	it('resolveConnectorUserId returns the supabase id without resolving a room', async () => {
		const db = {
			select: sinon.stub().callsFake(() => makeSelectChain([{ userId: 'supabase-user-1' }])),
		};
		const guildRoomManager = {
			resolveRoomForUser: sinon.stub().resolves('should-not-be-called'),
		};
		const interaction = {
			user: { id: 'discord-snowflake-1', username: 'Alice' },
			guildId: 'guild-abc',
		};
		const ctx = {
			db: db as any,
			guildRoomManager: guildRoomManager as any,
			roomManager: {} as any,
			bot: {} as any,
		};

		const userId = await resolveConnectorUserId(interaction as any, ctx as any);
		expect(userId).to.equal('supabase-user-1');
		expect(guildRoomManager.resolveRoomForUser.called).to.be.false;
	});
});

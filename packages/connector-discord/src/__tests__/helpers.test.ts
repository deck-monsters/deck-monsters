import { expect } from 'chai';
import sinon from 'sinon';
import { resolveUser } from '../slash-commands/helpers.js';

function makeSelectChain(result: unknown[]) {
	const limitStub = sinon.stub().resolves(result);
	const whereResult = Object.assign(Promise.resolve(result), { limit: limitStub });
	const whereStub = sinon.stub().returns(whereResult);
	const fromStub = sinon.stub().returns({ where: whereStub });
	return { from: fromStub };
}

describe('resolveUser', () => {
	afterEach(() => sinon.restore());

	it('resolves the guild/user active room (not always the default)', async () => {
		// ensureConnectorUser short-circuits when a connector row already exists —
		// no Supabase admin client needed.
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
});

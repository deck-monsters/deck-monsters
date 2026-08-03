import { expect } from 'chai';
import sinon from 'sinon';
import { createRoom } from '../slash-commands/create-room.js';
import { joinRoom } from '../slash-commands/join-room.js';

function makeSelectChain(result: unknown[]) {
	const limitStub = sinon.stub().resolves(result);
	const whereResult = Object.assign(Promise.resolve(result), { limit: limitStub });
	const whereStub = sinon.stub().returns(whereResult);
	const fromStub = sinon.stub().returns({ where: whereStub });
	return { from: fromStub };
}

function makeInteraction(opts: { guildId?: string | null; options: Record<string, string> }) {
	return {
		user: { id: 'discord-1', username: 'Alice' },
		guildId: opts.guildId === undefined ? 'guild-1' : opts.guildId,
		channelId: 'channel-1',
		deferReply: sinon.stub().resolves(),
		editReply: sinon.stub().resolves(),
		options: {
			getString: (name: string) => opts.options[name],
		},
	};
}

describe('create-room / join-room slash commands', () => {
	afterEach(() => sinon.restore());

	it('/create-room resolves identity only (no active-default write) then createSubRoom selects', async () => {
		const db = {
			select: sinon.stub().callsFake(() => makeSelectChain([{ userId: 'supabase-user-1' }])),
		};
		const resolveRoomForUser = sinon.stub().resolves('default-room');
		const createSubRoom = sinon.stub().resolves({ roomId: 'new-sub', inviteCode: 'CODE1234' });
		const ctx = {
			db: db as any,
			guildRoomManager: {
				resolveRoomForUser,
				createSubRoom,
			} as any,
			roomManager: {} as any,
			bot: {} as any,
		};

		const interaction = makeInteraction({ options: { name: 'Friends' } });
		await createRoom.execute(interaction as any, ctx);

		expect(resolveRoomForUser.called).to.be.false;
		expect(createSubRoom.calledOnceWith('guild-1', 'supabase-user-1', 'Friends')).to.be.true;
		expect(interaction.editReply.calledOnce).to.be.true;
		const reply = interaction.editReply.firstCall.args[0];
		expect(reply.content).to.include('new-sub');
		expect(reply.content).to.include('CODE1234');
	});

	it('/join-room resolves identity only then joinRoomByCode(guildId, ...) selects', async () => {
		const db = {
			select: sinon.stub().callsFake(() => makeSelectChain([{ userId: 'supabase-user-1' }])),
		};
		const resolveRoomForUser = sinon.stub().resolves('default-room');
		const joinRoomByCode = sinon.stub().resolves({ roomId: 'joined-room' });
		const ctx = {
			db: db as any,
			guildRoomManager: {
				resolveRoomForUser,
				joinRoomByCode,
			} as any,
			roomManager: {} as any,
			bot: {} as any,
		};

		const interaction = makeInteraction({ options: { code: 'INVITE99' } });
		await joinRoom.execute(interaction as any, ctx);

		expect(resolveRoomForUser.called).to.be.false;
		expect(joinRoomByCode.calledOnceWith('guild-1', 'supabase-user-1', 'INVITE99')).to.be.true;
		expect(interaction.editReply.calledOnce).to.be.true;
		expect(interaction.editReply.firstCall.args[0].content).to.include('joined-room');
	});
});

import { expect } from 'chai';
import sinon from 'sinon';

import { spawn, train } from '../slash-commands/spawn.js';
import { discordActiveFlows } from '../command-flow.js';

function makeSelectChain(result: unknown[]) {
	const limitStub = sinon.stub().resolves(result);
	const whereResult = Object.assign(Promise.resolve(result), { limit: limitStub });
	const whereStub = sinon.stub().returns(whereResult);
	const fromStub = sinon.stub().returns({ where: whereStub });
	return { from: fromStub };
}

function makeCommandEnv() {
	const handleCommand = sinon.stub().returns(async () => undefined);
	const interaction = {
		user: { id: 'discord-1', username: 'Alice' },
		guildId: 'guild-1',
		channelId: 'channel-1',
		deferReply: sinon.stub().resolves(),
		editReply: sinon.stub().resolves(),
	};
	const ctx = {
		db: {
			select: sinon.stub().callsFake(() => makeSelectChain([{ userId: 'supabase-user-1' }])),
		} as any,
		guildRoomManager: {
			resolveRoomForUser: sinon.stub().resolves('room-1'),
		} as any,
		roomManager: {
			getGame: sinon.stub().resolves({ handleCommand }),
			getMemberRole: sinon.stub().resolves('member'),
			runSerializedEngineWork: async (_lane: string, fn: () => Promise<unknown>) => fn(),
		} as any,
		bot: {
			getOrCreateSubscription: sinon.stub().resolves({
				registerUser: sinon.stub(),
				buildPrivateChannel: sinon.stub().returns(async () => undefined),
			}),
		} as any,
	};

	return { interaction, ctx, handleCommand };
}

describe('/train slash command', () => {
	afterEach(() => {
		discordActiveFlows.clear();
		sinon.restore();
	});

	it('registers train as the canonical command and keeps spawn as its alias', async () => {
		const { loadCommands } = await import('../slash-commands/index.js');
		const commands = loadCommands();

		expect(train.data.name).to.equal('train');
		expect(spawn.data.name).to.equal('spawn');
		expect(spawn.data.description).to.include('(alias of /train)');
		expect(commands.has('train')).to.equal(true);
		expect(commands.has('spawn')).to.equal(true);
	});

	for (const [name, command] of [
		['/train', train],
		['/spawn', spawn],
	] as const) {
		it(`${name} dispatches the shared training flow`, async () => {
			const { interaction, ctx, handleCommand } = makeCommandEnv();

			await command.execute(interaction as any, ctx);

			expect(handleCommand.calledOnceWithExactly({ command: 'train a monster' })).to.equal(true);
		});
	}
});

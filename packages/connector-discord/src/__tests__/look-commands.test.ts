import { expect } from 'chai';
import sinon from 'sinon';
import { status } from '../slash-commands/status.js';
import { monsters } from '../slash-commands/monsters.js';
import { discordActiveFlows } from '../command-flow.js';

function makeSelectChain(result: unknown[]) {
	const limitStub = sinon.stub().resolves(result);
	const whereResult = Object.assign(Promise.resolve(result), { limit: limitStub });
	const whereStub = sinon.stub().returns(whereResult);
	const fromStub = sinon.stub().returns({ where: whereStub });
	return { from: fromStub };
}

function makeEnv(opts: { recognized?: boolean; character?: Record<string, unknown> } = {}) {
	const recognized = opts.recognized ?? true;
	const handleCommand = sinon.stub().returns(recognized ? async () => undefined : null);
	const character = opts.character ?? {};

	const ctx = {
		db: { select: sinon.stub().callsFake(() => makeSelectChain([{ userId: 'user-1' }])) } as any,
		guildRoomManager: { resolveRoomForUser: sinon.stub().resolves('room-1') } as any,
		roomManager: {
			getGame: sinon.stub().resolves({
				handleCommand,
				getCharacter: sinon.stub().resolves(character),
			}),
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

	return { ctx, handleCommand };
}

function makeInteraction(sub: string, options: Record<string, string | null> = {}) {
	return {
		user: { id: 'discord-1', username: 'Alice' },
		guildId: 'guild-1',
		channelId: 'channel-1',
		deferReply: sinon.stub().resolves(),
		editReply: sinon.stub().resolves(),
		options: {
			getSubcommand: () => sub,
			getString: (name: string) => options[name] ?? null,
		},
	};
}

describe('/status and /monsters', () => {
	afterEach(() => {
		discordActiveFlows.clear();
		sinon.restore();
	});

	// Both once sent text no engine handler matched ("look at me", "look at my monsters"),
	// so they always replied with an error; they now send catalogue commands.
	const cases: Array<[string, typeof status, string]> = [
		['/status', status, 'look at character'],
		['/monsters', monsters, 'look at monsters'],
	];

	cases.forEach(([name, command, expected]) => {
		it(`${name} dispatches "${expected}"`, async () => {
			const { ctx, handleCommand } = makeEnv();
			const interaction = makeInteraction('x');

			await command.execute(interaction as any, ctx);

			expect(handleCommand.calledOnceWith({ command: expected })).to.be.true;
			expect(interaction.editReply.firstCall.args[0].content).to.equal('✅');
		});
	});
});

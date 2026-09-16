import { expect } from 'chai';
import sinon from 'sinon';
import { preset } from '../slash-commands/preset.js';
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

describe('/preset slash command', () => {
	afterEach(() => {
		discordActiveFlows.clear();
		sinon.restore();
	});

	it('is registered in the command map', async () => {
		const { loadCommands } = await import('../slash-commands/index.js');
		expect(loadCommands().has('preset')).to.be.true;
	});

	const cases: Array<[string, Record<string, string>, string, string]> = [
		['save', { monster: 'Stonefang', name: 'aggro' }, 'save preset aggro for Stonefang', '✅'],
		['load', { monster: 'Stonefang', name: 'aggro' }, 'load preset aggro on Stonefang', '✅'],
		['delete', { monster: 'Stonefang', name: 'aggro' }, 'delete preset aggro for Stonefang', '🗑️'],
		['list', { monster: 'Stonefang' }, 'look at presets for Stonefang', '✅'],
	];

	cases.forEach(([sub, options, expected, marker]) => {
		it(`/preset ${sub} dispatches "${expected}"`, async () => {
			const { ctx, handleCommand } = makeEnv();
			const interaction = makeInteraction(sub, options);

			await preset.execute(interaction as any, ctx);

			expect(interaction.deferReply.calledOnce).to.be.true;
			expect(handleCommand.calledOnceWith({ command: expected })).to.be.true;
			expect(interaction.editReply.firstCall.args[0].content).to.include(marker);
		});
	});

	it('/preset list without a monster lists every monster', async () => {
		const { ctx, handleCommand } = makeEnv();
		const interaction = makeInteraction('list', {});

		await preset.execute(interaction as any, ctx);

		expect(handleCommand.calledOnceWith({ command: 'look at presets' })).to.be.true;
	});

	it('builds the monster name as the trailing token so the engine splits correctly', async () => {
		// The engine's greedy preset-name capture splits on the LAST separator,
		// so a preset name containing " for " must still resolve the monster.
		const { ctx, handleCommand } = makeEnv();
		const interaction = makeInteraction('save', {
			monster: 'Stonefang',
			name: 'tank for bosses',
		});

		await preset.execute(interaction as any, ctx);

		expect(handleCommand.calledOnceWith({
			command: 'save preset tank for bosses for Stonefang',
		})).to.be.true;
	});

	it('reports failure when the engine does not recognize the command', async () => {
		const { ctx } = makeEnv({ recognized: false });
		const interaction = makeInteraction('load', { monster: 'Ghost', name: 'aggro' });

		await preset.execute(interaction as any, ctx);

		expect(interaction.editReply.firstCall.args[0].content).to.include('Could not load');
	});

	describe('autocomplete', () => {
		function makeAutocomplete(focused: { name: string; value: string }, options: Record<string, string | null> = {}) {
			return {
				user: { id: 'discord-1', username: 'Alice' },
				guildId: 'guild-1',
				channelId: 'channel-1',
				respond: sinon.stub().resolves(),
				options: {
					getFocused: () => focused,
					getString: (name: string) => options[name] ?? null,
				},
			};
		}

		it('suggests the caller’s monsters, filtered by the typed prefix', async () => {
			const { ctx } = makeEnv({
				character: { monsters: [{ givenName: 'Stonefang' }, { givenName: 'Emberclaw' }] },
			});
			const interaction = makeAutocomplete({ name: 'monster', value: 'stone' });

			await preset.autocomplete!(interaction as any, ctx);

			expect(interaction.respond.firstCall.args[0]).to.deep.equal([
				{ name: 'Stonefang', value: 'Stonefang' },
			]);
		});

		it('suggests preset names scoped to the chosen monster', async () => {
			const getPresets = sinon.stub().returns({ tank: ['Hit'], aggro: ['Hit'] });
			const { ctx } = makeEnv({ character: { getPresets } });
			const interaction = makeAutocomplete({ name: 'name', value: '' }, { monster: 'Stonefang' });

			await preset.autocomplete!(interaction as any, ctx);

			expect(getPresets.calledOnceWith('Stonefang')).to.be.true;
			expect(interaction.respond.firstCall.args[0]).to.deep.equal([
				{ name: 'aggro', value: 'aggro' },
				{ name: 'tank', value: 'tank' },
			]);
		});

		it('responds empty for preset names when no monster has been chosen yet', async () => {
			const getPresets = sinon.stub().returns({ tank: ['Hit'] });
			const { ctx } = makeEnv({ character: { getPresets } });
			const interaction = makeAutocomplete({ name: 'name', value: '' });

			await preset.autocomplete!(interaction as any, ctx);

			expect(getPresets.called).to.be.false;
			expect(interaction.respond.firstCall.args[0]).to.deep.equal([]);
		});

		it('degrades to an empty list when the lookup throws', async () => {
			const { ctx } = makeEnv();
			ctx.roomManager.getGame = sinon.stub().rejects(new Error('room down'));
			const interaction = makeAutocomplete({ name: 'monster', value: 'a' });

			await preset.autocomplete!(interaction as any, ctx);

			expect(interaction.respond.firstCall.args[0]).to.deep.equal([]);
		});
	});
});

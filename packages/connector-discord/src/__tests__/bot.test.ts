import { expect } from 'chai';
import sinon from 'sinon';
import { DiscordBot } from '../bot.js';
import { CommandRefusalError, announceAndThrow } from '@deck-monsters/engine';

// ---------------------------------------------------------------------------
// Minimal stub factories
// ---------------------------------------------------------------------------

function makeInteraction(commandName: string, deferred = true) {
	return {
		commandName,
		deferred,
		replied: false,
		deferReply: sinon.stub().resolves(),
		editReply: sinon.stub().resolves(),
		reply: sinon.stub().resolves(),
		followUp: sinon.stub().resolves(),
		user: { id: 'discord-user-1', username: 'TestUser' },
		guildId: 'guild-1',
		channelId: 'channel-1',
	};
}

function makeBot(
	logSpy: sinon.SinonSpy,
	overrides: { guildRoomManager?: object; roomManager?: object; db?: object } = {}
) {
	return new DiscordBot(
		(overrides.roomManager ?? {}) as any,
		(overrides.guildRoomManager ?? {}) as any,
		(overrides.db ?? {}) as any,
		logSpy
	);
}

// ---------------------------------------------------------------------------

describe('DiscordBot slash command error handling', () => {
	afterEach(() => sinon.restore());

	it('edits the interaction with the exact refusal message on CommandRefusalError, and does not log it', async () => {
		const logSpy = sinon.spy();
		const bot = makeBot(logSpy);

		const refusalMessage = 'You need a monster in the ring before you can summon a boss.';
		(bot as any).commands.set('summon-boss', {
			data: { name: 'summon-boss' },
			execute: async () => {
				throw new CommandRefusalError(refusalMessage);
			},
		});

		const interaction = makeInteraction('summon-boss', /* deferred */ true);
		await (bot as any).handleSlashCommand(interaction);

		expect(interaction.editReply.calledOnce).to.be.true;
		expect(interaction.editReply.firstCall.args[0]).to.deep.include({ content: refusalMessage });
		expect(logSpy.called).to.be.false;
	});

	it('edits interaction with "Something went wrong" on unexpected errors and logs them', async () => {
		const logSpy = sinon.spy();
		const bot = makeBot(logSpy);

		const unexpectedError = new Error('DB connection lost');
		(bot as any).commands.set('summon-boss', {
			data: { name: 'summon-boss' },
			execute: async () => {
				throw unexpectedError;
			},
		});

		const interaction = makeInteraction('summon-boss', /* deferred */ true);
		await (bot as any).handleSlashCommand(interaction);

		expect(interaction.editReply.calledOnce).to.be.true;
		expect(interaction.editReply.firstCall.args[0]).to.deep.include({
			content: 'Something went wrong. Please try again.',
		});
		expect(logSpy.calledOnce).to.be.true;
		expect(logSpy.firstCall.args[0]).to.equal(unexpectedError);
	});

	it('uses reply instead of editReply when interaction is not yet deferred', async () => {
		const logSpy = sinon.spy();
		const bot = makeBot(logSpy);

		const refusalMessage = 'Your daily boss summon quota is exhausted.';
		(bot as any).commands.set('summon-boss', {
			data: { name: 'summon-boss' },
			execute: async () => {
				throw new CommandRefusalError(refusalMessage);
			},
		});

		const interaction = makeInteraction('summon-boss', /* deferred */ false);
		await (bot as any).handleSlashCommand(interaction);

		expect(interaction.reply.calledOnce).to.be.true;
		expect(interaction.reply.firstCall.args[0]).to.deep.include({
			content: refusalMessage,
			ephemeral: true,
		});
		expect(interaction.editReply.called).to.be.false;
	});

	it('blocked DM path: real announceAndThrow through a silent channel still shows message on the interaction', async () => {
		const logSpy = sinon.spy();
		const bot = makeBot(logSpy);

		const refusalMessage =
			'A fight is already underway — wait for it to finish before summoning a boss.';

		(bot as any).commands.set('summon-boss', {
			data: { name: 'summon-boss' },
			execute: async () => {
				const blockedChannel = async () => undefined;
				await announceAndThrow(blockedChannel, refusalMessage);
			},
		});

		const interaction = makeInteraction('summon-boss', /* deferred */ true);
		await (bot as any).handleSlashCommand(interaction);

		expect(interaction.editReply.calledOnce).to.be.true;
		expect(interaction.editReply.firstCall.args[0]).to.deep.include({ content: refusalMessage });
		expect(logSpy.called).to.be.false;
	});

	it('isCommandRefusal sentinel: detects refusal even when instanceof fails across module boundaries', async () => {
		const logSpy = sinon.spy();
		const bot = makeBot(logSpy);

		const refusalMessage = 'Ring is at capacity.';
		const foreignRefusal = Object.assign(new Error(refusalMessage), { isCommandRefusal: true });

		(bot as any).commands.set('summon-boss', {
			data: { name: 'summon-boss' },
			execute: async () => {
				throw foreignRefusal;
			},
		});

		const interaction = makeInteraction('summon-boss', /* deferred */ true);
		await (bot as any).handleSlashCommand(interaction);

		expect(interaction.editReply.calledOnce).to.be.true;
		expect(interaction.editReply.firstCall.args[0]).to.deep.include({ content: refusalMessage });
		expect(logSpy.called).to.be.false;
	});
});

describe('DiscordBot getOrCreateSubscription announcement routing', () => {
	afterEach(() => sinon.restore());

	it('loads the announcement channel for each room in the guild, not only the default', async () => {
		const getAnnouncementChannel = sinon.stub();
		getAnnouncementChannel.withArgs('guild-1', 'room-default').resolves('ch-default');
		getAnnouncementChannel.withArgs('guild-1', 'room-sub').resolves('ch-sub');

		const bot = makeBot(sinon.spy(), {
			guildRoomManager: { getAnnouncementChannel },
			roomManager: {
				getEventBus: sinon.stub().resolves({ subscribe: sinon.stub().returns(sinon.stub()) }),
			},
		});

		const subDefault = await bot.getOrCreateSubscription('guild-1', 'room-default');
		const subSub = await bot.getOrCreateSubscription('guild-1', 'room-sub');

		expect(getAnnouncementChannel.calledWithExactly('guild-1', 'room-default')).to.be.true;
		expect(getAnnouncementChannel.calledWithExactly('guild-1', 'room-sub')).to.be.true;
		expect(getAnnouncementChannel.calledWithExactly('guild-1')).to.be.false;
		expect(subDefault).to.exist;
		expect(subSub).to.exist;
		expect(subDefault).to.not.equal(subSub);
	});
});

describe('DiscordBot expected prompt abort handling', () => {
	afterEach(() => sinon.restore());

	it('does not log PromptCancelledError from slash commands', async () => {
		const { PromptCancelledError } = await import('@deck-monsters/engine');
		const logSpy = sinon.spy();
		const bot = makeBot(logSpy);

		(bot as any).commands.set('spawn', {
			data: { name: 'spawn' },
			execute: async () => {
				throw new PromptCancelledError();
			},
		});

		const interaction = makeInteraction('spawn', /* deferred */ true);
		await (bot as any).handleSlashCommand(interaction);

		expect(logSpy.called).to.be.false;
		expect(interaction.editReply.called).to.be.false;
	});

	it('does not log prompt timeout errors from slash commands', async () => {
		const logSpy = sinon.spy();
		const bot = makeBot(logSpy);

		(bot as any).commands.set('spawn', {
			data: { name: 'spawn' },
			execute: async () => {
				throw new Error('Prompt timed out — no response within the allowed time.');
			},
		});

		const interaction = makeInteraction('spawn', /* deferred */ true);
		await (bot as any).handleSlashCommand(interaction);

		expect(logSpy.called).to.be.false;
		expect(interaction.editReply.called).to.be.false;
	});
});

describe('DiscordBot handleMessage free-text error parity', () => {
	afterEach(() => {
		sinon.restore();
		return import('../command-flow.js').then(({ discordActiveFlows }) => {
			discordActiveFlows.clear();
		});
	});

	function makeSelectChain(result: unknown[]) {
		const limitStub = sinon.stub().resolves(result);
		const whereResult = Object.assign(Promise.resolve(result), { limit: limitStub });
		const whereStub = sinon.stub().returns(whereResult);
		const fromStub = sinon.stub().returns({ where: whereStub });
		return { from: fromStub };
	}

	function makeDbWithExistingUser(userId = 'supabase-user-1') {
		return {
			select: sinon.stub().callsFake(() => makeSelectChain([{ userId }])),
		};
	}

	function makeDmMessage(content: string) {
		return {
			author: { bot: false, id: 'discord-user-1', username: 'TestUser' },
			content,
			guildId: null as string | null,
			channelId: 'dm-1',
			reply: sinon.stub().resolves(),
		};
	}

	async function makeHandleMessageBot(
		logSpy: sinon.SinonSpy,
		action: () => Promise<unknown>
	) {
		const handleCommand = sinon.stub().returns(action);
		const bot = makeBot(logSpy, {
			db: makeDbWithExistingUser(),
			guildRoomManager: {
				resolveRoomForUser: sinon.stub().resolves('room-abc'),
			},
			roomManager: {
				getGame: sinon.stub().resolves({ handleCommand }),
				getMemberRole: sinon.stub().resolves('member'),
				runSerializedEngineWork: async (_key: string, fn: () => Promise<unknown>) => fn(),
			},
		});
		sinon.stub(bot, 'getOrCreateSubscription').resolves({
			registerUserFromMessage: sinon.stub(),
			buildPrivateChannel: sinon.stub().returns(async () => undefined),
		} as any);
		return bot;
	}

	it('replies with CommandRefusalError text and does not log', async () => {
		const { CommandRefusalError } = await import('@deck-monsters/engine');
		const refusalMessage = 'You need a monster in the ring before you can summon a boss.';
		const logSpy = sinon.spy();
		const bot = await makeHandleMessageBot(logSpy, async () => {
			throw new CommandRefusalError(refusalMessage);
		});
		const message = makeDmMessage('summon a boss');

		await (bot as any).handleMessage(message);

		expect(message.reply.calledOnce).to.be.true;
		expect(message.reply.firstCall.args[0]).to.equal(refusalMessage);
		expect(logSpy.called).to.be.false;
	});

	it('replies with busy-flow text when a same-user flow is already active', async () => {
		const { busyFlowMessage } = await import('../command-flow.js');
		let release!: () => void;
		const held = new Promise<void>((resolve) => {
			release = resolve;
		});

		let calls = 0;
		const handleCommand = sinon.stub().callsFake(() => {
			calls += 1;
			if (calls === 1) return async () => held;
			return async () => undefined;
		});

		const logSpy = sinon.spy();
		const bot = makeBot(logSpy, {
			db: makeDbWithExistingUser(),
			guildRoomManager: {
				resolveRoomForUser: sinon.stub().resolves('room-abc'),
			},
			roomManager: {
				getGame: sinon.stub().resolves({ handleCommand }),
				getMemberRole: sinon.stub().resolves('member'),
				runSerializedEngineWork: async (_key: string, fn: () => Promise<unknown>) => fn(),
			},
		});
		sinon.stub(bot, 'getOrCreateSubscription').resolves({
			registerUserFromMessage: sinon.stub(),
			buildPrivateChannel: sinon.stub().returns(async () => undefined),
		} as any);

		const first = (bot as any).handleMessage(makeDmMessage('spawn'));
		await new Promise((r) => setImmediate(r));

		const second = makeDmMessage('look at ring');
		await (bot as any).handleMessage(second);

		expect(second.reply.calledOnce).to.be.true;
		expect(second.reply.firstCall.args[0]).to.equal(busyFlowMessage);
		expect(logSpy.called).to.be.false;

		release();
		await first;
	});

	it('stays silent (no reply, no log) on PromptCancelledError', async () => {
		const { PromptCancelledError } = await import('@deck-monsters/engine');
		const logSpy = sinon.spy();
		const bot = await makeHandleMessageBot(logSpy, async () => {
			throw new PromptCancelledError();
		});
		const message = makeDmMessage('spawn');

		await (bot as any).handleMessage(message);

		expect(message.reply.called).to.be.false;
		expect(logSpy.called).to.be.false;
	});

	it('stays silent (no reply, no log) on prompt timeout', async () => {
		const logSpy = sinon.spy();
		const bot = await makeHandleMessageBot(logSpy, async () => {
			throw new Error('Prompt timed out — no response within the allowed time.');
		});
		const message = makeDmMessage('spawn');

		await (bot as any).handleMessage(message);

		expect(message.reply.called).to.be.false;
		expect(logSpy.called).to.be.false;
	});

	it('logs unexpected errors and replies with generic text', async () => {
		const logSpy = sinon.spy();
		const unexpected = new Error('DB connection lost');
		const bot = await makeHandleMessageBot(logSpy, async () => {
			throw unexpected;
		});
		const message = makeDmMessage('spawn');

		await (bot as any).handleMessage(message);

		expect(logSpy.calledOnce).to.be.true;
		expect(logSpy.firstCall.args[0]).to.equal(unexpected);
		expect(message.reply.calledOnce).to.be.true;
		expect(message.reply.firstCall.args[0]).to.equal(
			'Something went wrong processing your command.'
		);
	});
});

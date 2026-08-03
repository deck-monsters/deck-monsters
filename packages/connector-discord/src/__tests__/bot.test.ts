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

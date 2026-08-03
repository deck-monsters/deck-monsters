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

function makeBot(logSpy: sinon.SinonSpy) {
	return new DiscordBot(
		{} as any, // roomManager — not called in handleSlashCommand
		{} as any, // guildRoomManager — not called in handleSlashCommand
		{} as any, // db — not called in handleSlashCommand
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
			execute: async () => { throw new CommandRefusalError(refusalMessage); },
		});

		const interaction = makeInteraction('summon-boss', /* deferred */ true);
		await (bot as any).handleSlashCommand(interaction);

		// Must show the exact refusal message on the ephemeral interaction
		expect(interaction.editReply.calledOnce).to.be.true;
		expect(interaction.editReply.firstCall.args[0]).to.deep.include({ content: refusalMessage });

		// Must NOT log the refusal — it is expected behavior, not an error
		expect(logSpy.called).to.be.false;
	});

	it('edits interaction with "Something went wrong" on unexpected errors and logs them', async () => {
		const logSpy = sinon.spy();
		const bot = makeBot(logSpy);

		const unexpectedError = new Error('DB connection lost');
		(bot as any).commands.set('summon-boss', {
			data: { name: 'summon-boss' },
			execute: async () => { throw unexpectedError; },
		});

		const interaction = makeInteraction('summon-boss', /* deferred */ true);
		await (bot as any).handleSlashCommand(interaction);

		// Must show generic message — do NOT surface raw error details to users
		expect(interaction.editReply.calledOnce).to.be.true;
		expect(interaction.editReply.firstCall.args[0]).to.deep.include({
			content: 'Something went wrong. Please try again.',
		});

		// Must log the unexpected error for ops visibility
		expect(logSpy.calledOnce).to.be.true;
		expect(logSpy.firstCall.args[0]).to.equal(unexpectedError);
	});

	it('uses reply instead of editReply when interaction is not yet deferred', async () => {
		const logSpy = sinon.spy();
		const bot = makeBot(logSpy);

		const refusalMessage = 'Your daily boss summon quota is exhausted.';
		(bot as any).commands.set('summon-boss', {
			data: { name: 'summon-boss' },
			execute: async () => { throw new CommandRefusalError(refusalMessage); },
		});

		// Not deferred — simulates an error before deferReply is called
		const interaction = makeInteraction('summon-boss', /* deferred */ false);
		await (bot as any).handleSlashCommand(interaction);

		expect(interaction.reply.calledOnce).to.be.true;
		expect(interaction.reply.firstCall.args[0]).to.deep.include({ content: refusalMessage, ephemeral: true });
		expect(interaction.editReply.called).to.be.false;
	});

	it('blocked DM path: real announceAndThrow through a silent channel still shows message on the interaction', async () => {
		// Production scenario: the private channel callback's sendDm is silently suppressed
		// (DMs are blocked or the user is not cached). The channel resolves with undefined —
		// exactly what buildPrivateChannel.sendDm does on a discord.js fetch failure.
		// announceAndThrow awaits this silent channel, then throws CommandRefusalError.
		// handleSlashCommand must edit the deferred interaction with the exact refusal text.
		const logSpy = sinon.spy();
		const bot = makeBot(logSpy);

		const refusalMessage = 'A fight is already underway — wait for it to finish before summoning a boss.';

		(bot as any).commands.set('summon-boss', {
			data: { name: 'summon-boss' },
			execute: async () => {
				// Real announceAndThrow through a channel that silently drops the DM
				// (identical behavior to buildPrivateChannel.sendDm when DMs are blocked).
				const blockedChannel = async () => undefined;
				await announceAndThrow(blockedChannel, refusalMessage);
			},
		});

		const interaction = makeInteraction('summon-boss', /* deferred */ true);
		await (bot as any).handleSlashCommand(interaction);

		// Refusal message must appear on the interaction even though the DM was silently lost
		expect(interaction.editReply.calledOnce).to.be.true;
		expect(interaction.editReply.firstCall.args[0]).to.deep.include({ content: refusalMessage });
		expect(logSpy.called).to.be.false;
	});

	it('isCommandRefusal sentinel: detects refusal even when instanceof fails across module boundaries', async () => {
		// Guard against duplicate module instantiation (e.g. different dist vs src resolution
		// in tests or when engine is bundled differently). The bot uses the isCommandRefusal
		// property sentinel, so an object that carries the property but is not instanceof
		// CommandRefusalError in *this* realm is still treated as a refusal.
		const logSpy = sinon.spy();
		const bot = makeBot(logSpy);

		const refusalMessage = 'Ring is at capacity.';
		// Simulate a foreign-realm CommandRefusalError: plain object with isCommandRefusal=true
		const foreignRefusal = Object.assign(new Error(refusalMessage), { isCommandRefusal: true });

		(bot as any).commands.set('summon-boss', {
			data: { name: 'summon-boss' },
			execute: async () => { throw foreignRefusal; },
		});

		const interaction = makeInteraction('summon-boss', /* deferred */ true);
		await (bot as any).handleSlashCommand(interaction);

		// The sentinel-based guard must recognize it as a refusal
		expect(interaction.editReply.calledOnce).to.be.true;
		expect(interaction.editReply.firstCall.args[0]).to.deep.include({ content: refusalMessage });
		expect(logSpy.called).to.be.false;
	});
});

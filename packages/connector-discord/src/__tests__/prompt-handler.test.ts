import { expect } from 'chai';
import sinon from 'sinon';
import { PromptHandler } from '../prompt-handler.js';

// ---------------------------------------------------------------------------
// Mock discord.js interaction + message component collector
// ---------------------------------------------------------------------------

function makeCollector(
	opts: { collectChoice?: string; timeout?: boolean } = {}
) {
	const listeners: Record<string, ((...args: unknown[]) => void)[]> = {};

	const collector = {
		on: sinon.stub().callsFake((event: string, fn: (...args: unknown[]) => void) => {
			listeners[event] = listeners[event] ?? [];
			listeners[event].push(fn);
		}),
		_emit(event: string, ...args: unknown[]) {
			for (const fn of listeners[event] ?? []) fn(...args);
		},
	};

	// Simulate a button click (or timeout) after a short delay
	setImmediate(() => {
		if (opts.timeout) {
			// No collect event — triggers the 'end' with empty collection
			const empty = { size: 0 };
			collector._emit('end', empty);
		} else if (opts.collectChoice) {
			const mockBtnInteraction = {
				customId: opts.collectChoice,
				user: { id: 'user-1' },
				update: sinon.stub().resolves(),
			};
			collector._emit('collect', mockBtnInteraction);
			collector._emit('end', { size: 1 });
		}
	});

	return collector;
}

function makeMessage(collectorChoice?: string, timeout = false) {
	const collector = makeCollector({ collectChoice: collectorChoice, timeout });

	return {
		createMessageComponentCollector: sinon.stub().returns(collector),
	};
}

function makeInteraction(message: ReturnType<typeof makeMessage>) {
	return {
		user: { id: 'user-1' },
		followUp: sinon.stub().resolves(message),
	};
}

// ---------------------------------------------------------------------------

describe('PromptHandler', () => {
	afterEach(() => sinon.restore());

	it('sends a follow-up with buttons and resolves with the chosen option', async () => {
		const msg = makeMessage('2');
		const interaction = makeInteraction(msg);

		const handler = new PromptHandler();
		const answer = await handler.sendPrompt(
			interaction as any,
			'Which card?',
			['1', '2', '3']
		);

		expect(answer).to.equal('2');
		expect(interaction.followUp.calledOnce).to.be.true;

		const followUpArgs = interaction.followUp.firstCall.args[0];
		expect(followUpArgs.content).to.equal('Which card?');
		expect(followUpArgs.ephemeral).to.be.true;
		// Should have a components array with at least one row
		expect(followUpArgs.components).to.have.length(1);
	});

	it('rejects when the prompt times out', async () => {
		const msg = makeMessage(undefined, true);
		const interaction = makeInteraction(msg);

		const handler = new PromptHandler();

		try {
			await handler.sendPrompt(interaction as any, 'Choose:', ['yes', 'no']);
			expect.fail('Should have rejected on timeout');
		} catch (err) {
			expect((err as Error).message).to.match(/timed out/i);
		}
	});

	it('caps button count at 5 when more than 5 choices are provided', async () => {
		const choices = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
		const msg = makeMessage('a');
		const interaction = makeInteraction(msg);

		const handler = new PromptHandler();
		await handler.sendPrompt(interaction as any, 'Pick:', choices);

		const followUpArgs = interaction.followUp.firstCall.args[0];
		const row = followUpArgs.components[0];
		// ActionRowBuilder — access via components property
		expect(row.components).to.have.length(5);
	});
});

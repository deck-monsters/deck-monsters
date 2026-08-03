import { expect } from 'chai';
import sinon from 'sinon';
import { PromptHandler } from '../prompt-handler.js';
import {
	discordActiveFlows,
	runDiscordCommandAction,
} from '../command-flow.js';

// ---------------------------------------------------------------------------
// Mock discord.js interaction + message component collector
// ---------------------------------------------------------------------------

function makeCollector(
	opts: { collectChoice?: string; timeout?: boolean; updateRejects?: boolean } = {}
) {
	const listeners: Record<string, ((...args: unknown[]) => void)[]> = {};
	const stop = sinon.stub();

	const collector = {
		on: sinon.stub().callsFake((event: string, fn: (...args: unknown[]) => void) => {
			listeners[event] = listeners[event] ?? [];
			listeners[event].push(fn);
		}),
		stop,
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
				update: opts.updateRejects
					? sinon.stub().rejects(new Error('Interaction already acknowledged'))
					: sinon.stub().resolves(),
			};
			collector._emit('collect', mockBtnInteraction);
			collector._emit('end', { size: 1 });
		}
	});

	return collector;
}

function makeMessage(collectorChoice?: string, timeout = false, updateRejects = false) {
	const collector = makeCollector({ collectChoice: collectorChoice, timeout, updateRejects });

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
	afterEach(() => {
		sinon.restore();
		discordActiveFlows.clear();
	});

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

	it('resolves with the chosen option when btnInteraction.update rejects', async () => {
		const msg = makeMessage('fire', false, true);
		const interaction = makeInteraction(msg);

		const handler = new PromptHandler();
		const answer = await handler.sendPrompt(
			interaction as any,
			'Which card?',
			['fire', 'ice']
		);

		expect(answer).to.equal('fire');
		const collector = msg.createMessageComponentCollector.returnValues[0];
		expect(collector.stop.called).to.be.true;
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

	it('sendDmPrompt sends buttons as a DM and resolves with the chosen option', async () => {
		const msg = makeMessage('fire');
		const dmChannel = {
			send: sinon.stub().resolves(msg),
		};
		const user = {
			createDM: sinon.stub().resolves(dmChannel),
		};
		const mockClient = {
			users: {
				fetch: sinon.stub().resolves(user),
			},
		};

		const handler = new PromptHandler();
		const answer = await handler.sendDmPrompt(
			mockClient as any,
			'user-42',
			'Which card?',
			['fire', 'ice', 'thunder']
		);

		expect(answer).to.equal('fire');
		expect(mockClient.users.fetch.calledWith('user-42')).to.be.true;
		expect(user.createDM.calledOnce).to.be.true;
		expect(dmChannel.send.calledOnce).to.be.true;

		const sendArgs = dmChannel.send.firstCall.args[0];
		expect(sendArgs.content).to.equal('Which card?');
		expect(sendArgs.components).to.have.length(1);
	});

	it('sendDmPrompt rejects when the DM prompt times out', async () => {
		const msg = makeMessage(undefined, true);
		const dmChannel = {
			send: sinon.stub().resolves(msg),
		};
		const user = {
			createDM: sinon.stub().resolves(dmChannel),
		};
		const mockClient = {
			users: { fetch: sinon.stub().resolves(user) },
		};

		const handler = new PromptHandler();

		try {
			await handler.sendDmPrompt(mockClient as any, 'user-42', 'Choose:', ['yes', 'no']);
			expect.fail('Should have rejected on timeout');
		} catch (err) {
			expect((err as Error).message).to.match(/timed out/i);
		}
	});

	// -----------------------------------------------------------------------
	// Free-text DM collector (#59)
	// -----------------------------------------------------------------------

	function makeTextCollector(opts: {
		answer?: string;
		fromUserId?: string;
		timeout?: boolean;
		extraMessages?: Array<{ authorId: string; content: string; channelId?: string }>;
	} = {}) {
		const listeners: Record<string, ((...args: unknown[]) => void)[]> = {};
		let filterFn: ((m: { author: { id: string }; channelId: string; content: string }) => boolean) | undefined;
		const stop = sinon.stub();

		const collector = {
			on: sinon.stub().callsFake((event: string, fn: (...args: unknown[]) => void) => {
				listeners[event] = listeners[event] ?? [];
				listeners[event].push(fn);
			}),
			stop,
			_emit(event: string, ...args: unknown[]) {
				for (const fn of listeners[event] ?? []) fn(...args);
			},
			_setFilter(fn: typeof filterFn) {
				filterFn = fn;
			},
		};

		setImmediate(() => {
			const channelId = 'dm-channel-1';
			for (const extra of opts.extraMessages ?? []) {
				const msg = {
					author: { id: extra.authorId },
					channelId: extra.channelId ?? channelId,
					content: extra.content,
				};
				if (filterFn?.(msg)) {
					collector._emit('collect', msg);
				}
			}

			if (opts.timeout) {
				collector._emit('end', { size: 0 }, 'time');
				return;
			}

			if (opts.answer !== undefined) {
				const msg = {
					author: { id: opts.fromUserId ?? 'user-42' },
					channelId,
					content: opts.answer,
				};
				if (!filterFn || filterFn(msg)) {
					collector._emit('collect', msg);
					collector._emit('end', { size: 1 }, 'limit');
				} else {
					collector._emit('end', { size: 0 }, 'time');
				}
			}
		});

		return collector;
	}

	function makeDmChannelForText(collector: ReturnType<typeof makeTextCollector>) {
		const channel = {
			id: 'dm-channel-1',
			send: sinon.stub().resolves({}),
			createMessageCollector: sinon.stub().callsFake((options: {
				filter?: (m: { author: { id: string }; channelId: string; content: string }) => boolean;
			}) => {
				collector._setFilter(options.filter);
				return collector;
			}),
		};
		return channel;
	}

	it('sendFreeTextDmPrompt resolves with the matching user DM text', async () => {
		const collector = makeTextCollector({ answer: 'Crimson Basilisk', fromUserId: 'user-42' });
		const dmChannel = makeDmChannelForText(collector);
		const user = { createDM: sinon.stub().resolves(dmChannel) };
		const mockClient = { users: { fetch: sinon.stub().resolves(user) } };

		const handler = new PromptHandler();
		const answer = await handler.sendFreeTextDmPrompt(
			mockClient as any,
			'user-42',
			'What would you like to name them?'
		);

		expect(answer).to.equal('Crimson Basilisk');
		expect(dmChannel.send.calledOnce).to.be.true;
		expect(dmChannel.send.firstCall.args[0]).to.deep.include({
			content: 'What would you like to name them?',
		});
		expect(dmChannel.createMessageCollector.calledOnce).to.be.true;
		const collectorOpts = dmChannel.createMessageCollector.firstCall.args[0];
		expect(collectorOpts.max).to.equal(1);
		expect(collectorOpts.time).to.be.a('number');
	});

	it('sendFreeTextDmPrompt filter ignores unrelated users and other channels', async () => {
		const collector = makeTextCollector({
			answer: 'MyName',
			fromUserId: 'user-42',
			extraMessages: [
				{ authorId: 'intruder', content: 'hijack' },
				{ authorId: 'user-42', content: 'wrong-channel', channelId: 'other-channel' },
			],
		});
		const dmChannel = makeDmChannelForText(collector);
		const user = { createDM: sinon.stub().resolves(dmChannel) };
		const mockClient = { users: { fetch: sinon.stub().resolves(user) } };

		const handler = new PromptHandler();
		const answer = await handler.sendFreeTextDmPrompt(
			mockClient as any,
			'user-42',
			'Name?'
		);

		expect(answer).to.equal('MyName');
		const filter = dmChannel.createMessageCollector.firstCall.args[0].filter;
		expect(filter({ author: { id: 'intruder' }, channelId: 'dm-channel-1', content: 'x' })).to.equal(false);
		expect(filter({ author: { id: 'user-42' }, channelId: 'other-channel', content: 'x' })).to.equal(false);
		expect(filter({ author: { id: 'user-42' }, channelId: 'dm-channel-1', content: 'ok' })).to.equal(true);
	});

	it('sendFreeTextDmPrompt rejects on timeout, calls onTimeout, and stops cleanly', async () => {
		const collector = makeTextCollector({ timeout: true });
		const dmChannel = makeDmChannelForText(collector);
		const user = { createDM: sinon.stub().resolves(dmChannel) };
		const mockClient = { users: { fetch: sinon.stub().resolves(user) } };
		const onTimeout = sinon.spy();

		const handler = new PromptHandler();

		try {
			await handler.sendFreeTextDmPrompt(
				mockClient as any,
				'user-42',
				'Name?',
				50,
				onTimeout
			);
			expect.fail('Should have rejected on timeout');
		} catch (err) {
			expect((err as Error).message).to.match(/timed out/i);
			expect(onTimeout.calledOnce).to.be.true;
		}
	});

	it('button prompt still releases discord flow lock when update rejects', async () => {
		const msg = makeMessage('yes', false, true);
		const interaction = makeInteraction(msg);
		const handler = new PromptHandler();
		const roomManager = {
			runSerializedEngineWork: async (_laneKey: string, fn: () => Promise<unknown>) => fn(),
		};

		await runDiscordCommandAction({
			roomManager,
			roomId: 'room-1',
			userId: 'user-1',
			action: async () =>
				handler.sendPrompt(interaction as any, 'Confirm?', ['yes', 'no']),
		});

		expect(discordActiveFlows.has('room-1:user-1')).to.equal(false);
	});
});

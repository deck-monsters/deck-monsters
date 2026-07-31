import { expect } from 'chai';
import { helpersReady } from '../../characters/helpers/random.js';
import { chooseItems } from './choose.js';
// Static import — a dynamic `await import()` here can resolve to a duplicate
// module instance under the tsx test transform, breaking `instanceof` against
// the class choose.ts itself uses. See the test-tooling note in bug doc #26's
// "Smaller observations" section.
import { PROMPT_CANCELLED, PromptCancelledError } from '../../events/index.js';

describe('chooseItems passes structured choices to channel', () => {
	before(async () => {
		await helpersReady;
	});

	it('channel is called with a choices array', async () => {
		const channelCalls: Array<{ question?: string; choices?: string[]; announce?: string }> = [];

		const items = [
			{ itemType: 'Hit', name: 'Hit', cost: 0 },
			{ itemType: 'Hit', name: 'Hit', cost: 0 },
			{ itemType: 'Heal', name: 'Heal', cost: 0 },
		];

		const channel = (args: { question?: string; choices?: string[]; announce?: string }) => {
			channelCalls.push(args);
			if (args.question) {
				// Return "0" to select the first item
				return Promise.resolve('0');
			}
			return Promise.resolve('');
		};

		await chooseItems({ items, channel } as any);

		const promptCall = channelCalls.find(c => c.choices !== undefined);
		expect(promptCall, 'channel should be called with a choices array').to.exist;
		expect(promptCall!.choices).to.be.an('array').with.length.greaterThan(0);
	});
});

describe('chooseItems answer parsing', () => {
	type FakeItem = { itemType: string; cost: number };

	const makeItems = (): FakeItem[] => [
		{ itemType: 'Potion', cost: 5 },
		{ itemType: 'Potion', cost: 5 },
		{ itemType: 'Scroll', cost: 10 },
	];

	/**
	 * Channel double: answers the first `question` with `answer`, records every
	 * `announce` for assertions.
	 */
	const makeChannel = (answer: unknown) => {
		const announcements: string[] = [];
		const channel = (opts: { question?: string; announce?: string }): Promise<unknown> => {
			if (opts.question) return Promise.resolve(answer);
			if (opts.announce) announcements.push(opts.announce);
			return Promise.resolve();
		};
		return { channel, announcements };
	};

	it('selects by displayed numeric index', async () => {
		const { channel } = makeChannel('0');
		const selected = await chooseItems({ items: makeItems(), channel } as never);

		expect(selected).to.have.length(1);
		expect((selected[0] as FakeItem).itemType).to.equal('Potion');
	});

	it('selects by item name, case-insensitively', async () => {
		const { channel } = makeChannel('scroll');
		const selected = await chooseItems({ items: makeItems(), channel } as never);

		expect(selected).to.have.length(1);
		expect((selected[0] as FakeItem).itemType).to.equal('Scroll');
	});

	it('selects multiple copies by repeating the same token', async () => {
		const { channel } = makeChannel('0, 0');
		const selected = await chooseItems({ items: makeItems(), channel } as never);

		expect(selected).to.have.length(2);
		expect(selected.every((item) => (item as FakeItem).itemType === 'Potion')).to.equal(true);
	});

	it('skips invalid tokens with a notice instead of aborting the whole selection', async () => {
		// Regression (bug doc #20): an unrecognized token used to reject the
		// entire flow via Promise.reject(channel(...)), aborting a multi-step
		// command on a single typo — and logging '[object Promise]' to boot.
		const { channel, announcements } = makeChannel('Potion, Bad Name');
		const selected = await chooseItems({ items: makeItems(), channel } as never);

		expect(selected).to.have.length(1);
		expect((selected[0] as FakeItem).itemType).to.equal('Potion');
		expect(announcements.some((text) => text.includes('Bad Name'))).to.equal(true);
	});

	it('returns an empty selection (not a rejection) when nothing valid was chosen', async () => {
		const { channel, announcements } = makeChannel('Nonsense');
		const selected = await chooseItems({ items: makeItems(), channel } as never);

		expect(selected).to.have.length(0);
		expect(announcements.some((text) => text.includes('no items'))).to.equal(true);
	});

	it('throws PromptCancelledError when the answer is the cancel sentinel', async () => {
		// Regression (bug doc #20): cancelling a flow resolves the pending prompt
		// with PROMPT_CANCELLED; before this guard the literal sentinel string was
		// parsed as a selection.
		const { channel } = makeChannel(PROMPT_CANCELLED);

		const err = await chooseItems({ items: makeItems(), channel } as never).catch(
			(e: unknown) => e
		);
		expect(err).to.be.instanceOf(PromptCancelledError);
	});
});

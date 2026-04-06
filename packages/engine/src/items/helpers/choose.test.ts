import { expect } from 'chai';
import { helpersReady } from '../../characters/helpers/random.js';
import { chooseItems } from './choose.js';

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

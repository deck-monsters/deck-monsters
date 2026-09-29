import { expect } from 'chai';
import { engineReady } from '@deck-monsters/engine';
import { runUnit } from './units.js';

describe('balance excitement tally', () => {
	before(async () => {
		await engineReady;
	});

	it('counts rounds, rare rolls, and turnarounds when a unit asks for them', async () => {
		const hand = ['Hit', 'Hit', 'Heal', 'Hit', 'Hit', 'Hit', 'Hit', 'Hit', 'Hit'];
		const result = await runUnit({
			id: 'excitement',
			sides: [{ type: 'Gladiator', level: 3, deck: hand }, { type: 'Minotaur', level: 3, deck: hand }],
			fights: 6,
			seed: 7,
			excitement: true,
		});
		const e = result.excitement!;
		expect(e.fights).to.equal(12);
		expect(e.decisive).to.be.at.most(e.fights);
		expect(e.rounds).to.be.greaterThan(0);
		expect(e.turnaround50).to.be.at.most(e.turnaround25);
		expect(e.turnaround25).to.be.at.most(e.decisive);
	});

	it('leaves the tally off by default', async () => {
		const hand = Array(9).fill('Hit') as string[];
		const result = await runUnit({ id: 'plain', sides: [{ type: 'Gladiator', level: 1, deck: hand }, { type: 'Gladiator', level: 1, deck: hand }], fights: 2, seed: 3 });
		expect(result.excitement).to.equal(undefined);
	});
});

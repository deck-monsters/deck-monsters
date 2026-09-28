import { expect } from 'chai';
import { engineReady } from '@deck-monsters/engine';
import { holdableCardTypes } from './holders.js';

describe('balance holders', () => {
	before(async () => {
		await engineReady;
	});

	it('reads what a monster can hold from the engine', () => {
		const dragon = holdableCardTypes('Dragon', 5);
		expect(dragon).to.include('Fire Breath');
		expect(dragon).to.include('Hit');
		expect(dragon).to.not.include('Sandstorm');
		expect(holdableCardTypes('Jinn', 5)).to.include('Sandstorm');
	});
});

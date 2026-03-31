import { expect } from 'chai';
import Minotaur from './minotaur.js';
import { MINOTAUR } from '../constants/creature-types.js';

describe('monsters/minotaur', () => {
	it('can be instantiated with defaults', () => {
		const minotaur = new Minotaur();

		expect(minotaur).to.be.instanceOf(Minotaur);
		expect(minotaur.name).to.equal('Minotaur');
		expect(minotaur.creatureType).to.equal(MINOTAUR);
		expect(minotaur.givenName).to.be.a('string');
		expect(minotaur.options).to.include({
			dexModifier: 1,
			strModifier: 2,
			intModifier: -1,
			color: 'angry red',
			icon: '🐗',
		});
	});

	it('can be instantiated with higher XP', () => {
		const minotaur = new Minotaur({ xp: 500 });

		expect(minotaur).to.be.instanceOf(Minotaur);
		expect(minotaur.options).to.include({
			dexModifier: 1,
			strModifier: 2,
			intModifier: -1,
			xp: 500,
		});
	});

	it('has a description', () => {
		const minotaur = new Minotaur();
		const desc = minotaur.description;

		expect(desc).to.be.a('string');
		expect(desc).to.include('minotaur');
	});
});

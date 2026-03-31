import { expect } from 'chai';
import Jinn from './jinn.js';
import { JINN } from '../constants/creature-types.js';

describe('monsters/jinn', () => {
	it('can be instantiated with defaults', () => {
		const jinn = new Jinn();

		expect(jinn).to.be.instanceOf(Jinn);
		expect(jinn.name).to.equal('Jinn');
		expect(jinn.creatureType).to.equal(JINN);
		expect(jinn.givenName).to.be.a('string');
		expect(jinn.options).to.include({
			dexModifier: 1,
			strModifier: 0,
			intModifier: 1,
			color: 'fiery red',
			icon: '🕌',
		});
	});
});

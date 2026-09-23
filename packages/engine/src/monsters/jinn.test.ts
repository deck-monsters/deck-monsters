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

	it('conjugates its description for they/them monsters', () => {
		const jinn = new Jinn({ gender: 'androgynous' });

		// Regression: the second question hard-coded "is" and read "What is they thinking about?"
		expect(jinn.description).to.include('who or what they are. What are they thinking about?');
		expect(new Jinn({ gender: 'female' }).description).to.include('What is she thinking about?');
	});
});

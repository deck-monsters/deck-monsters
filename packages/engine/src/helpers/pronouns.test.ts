import { expect } from 'chai';

import PRONOUNS, { PRONOUN_CHOICES, genderFromPronounChoice } from './pronouns.js';

describe('pronoun choices', () => {
	it('maps the connector-visible pronoun labels to persisted gender keys', () => {
		expect(PRONOUN_CHOICES).to.deep.equal(['he/him', 'she/her', 'they/them']);
		expect(genderFromPronounChoice('he/him')).to.equal('male');
		expect(genderFromPronounChoice('SHE/HER')).to.equal('female');
		expect(genderFromPronounChoice('they/them')).to.equal('androgynous');
	});

	it('accepts the 0-based index form sent by the web client', () => {
		expect(genderFromPronounChoice('0')).to.equal('male');
		expect(genderFromPronounChoice('1')).to.equal('female');
		expect(genderFromPronounChoice('2')).to.equal('androgynous');
	});

	it('rejects a value outside the shared label contract', () => {
		expect(genderFromPronounChoice('female')).to.equal(undefined);
		expect(genderFromPronounChoice('3')).to.equal(undefined);
	});
});
describe('helpers/pronouns', () => {
	it('uses singular they for androgynous characters and monsters', () => {
		expect(PRONOUNS.androgynous).to.deep.equal({
			he: 'they',
			him: 'them',
			his: 'their',
			is: 'are',
			was: 'were',
			verbSuffix: '',
		});
	});
});

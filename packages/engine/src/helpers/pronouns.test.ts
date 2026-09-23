import { expect } from 'chai';

import PRONOUNS, { PRONOUN_CHOICES, agree, genderFromPronounChoice } from './pronouns.js';

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

	it('picks the verb form that agrees with the pronoun', () => {
		expect(agree(PRONOUNS.androgynous, 'misses', 'miss')).to.equal('miss');
		expect(agree(PRONOUNS.female, 'misses', 'miss')).to.equal('misses');
		// Legacy serialized sets have no verbSuffix; keep the singular form like `verbSuffix ?? 's'`.
		expect(agree({ he: 'he', him: 'him', his: 'his' }, 'has', 'have')).to.equal('has');
	});
});

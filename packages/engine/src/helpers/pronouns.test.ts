import { expect } from 'chai';

import PRONOUNS from './pronouns.js';

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

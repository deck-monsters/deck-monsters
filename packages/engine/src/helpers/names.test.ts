import { expect } from 'chai';

import * as TYPES from '../constants/creature-types.js';
import { chooseName } from './names.js';

// Bug 214: the Dothraki list returned "Name (gloss, meaning)" and the female Lizardmen list
// sometimes "null…". Draw many names of every type and check none is dirty.
describe('chooseName', () => {
	const types: string[] = Object.values(TYPES);

	for (const type of types) {
		it(`gives clean names for ${type}`, () => {
			for (const gender of ['male', 'female', 'androgynous']) {
				for (let i = 0; i < 300; i++) {
					const name = chooseName(type, gender);
					expect(name, `${type}/${gender}`).to.be.a('string').and.not.equal('');
					expect(name, `${type}/${gender}: ${name}`).to.not.match(/[()]|null|undefined/i);
				}
			}
		});
	}

	it('never repeats a taken name', () => {
		const taken: string[] = [];
		for (let i = 0; i < 20; i++) taken.push(chooseName(TYPES.GLADIATOR, 'male', taken));
		expect(new Set(taken).size).to.equal(taken.length);
	});
});

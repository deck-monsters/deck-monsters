import { expect } from 'chai';

import { Rehit } from './rehit.js';
import { CLERIC, FIGHTER } from '../constants/creature-classes.js';

describe('./cards/rehit.ts', () => {
	it('can be instantiated with defaults and documents selected-roll crit semantics', () => {
		const rehit = new Rehit();

		expect(rehit).to.be.an.instanceof(Rehit);
		expect((Rehit as any).permittedClassesAndTypes).to.deep.equal([CLERIC, FIGHTER]);
		expect(rehit.stats).to.equal(
			'Hit: 1d20 vs ac / Damage: 1d6\nRoll for attack, if you roll less than 10, roll again and use the second roll no matter what. Stroke of Luck and Curse of Loki apply only to the selected roll (discarded rolls do not crit).'
		);
	});
});

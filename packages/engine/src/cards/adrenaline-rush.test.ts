import { expect } from 'chai';

import { AdrenalineRushCard } from './adrenaline-rush.js';
import { BARBARIAN, FIGHTER } from '../constants/creature-classes.js';

describe('./cards/adrenaline-rush.ts', () => {
	it('can be instantiated with defaults', () => {
		const adrenalineRush = new AdrenalineRushCard();

		expect(adrenalineRush).to.be.an.instanceof(AdrenalineRushCard);
		expect(adrenalineRush.cardType).to.equal('Adrenaline Rush');
		expect(adrenalineRush.icon).to.equal('❗️');
		expect((adrenalineRush as any).permittedClassesAndTypes).to.deep.equal([BARBARIAN, FIGHTER]);
		expect((adrenalineRush.constructor as any).description).to.equal(
			"Life or Death brings about a certain focus... A certain AWAKENESS most people don't actually want. It's what you live for. It's how you know you exist. You embrace it and welcome the rush."
		);
	});
});

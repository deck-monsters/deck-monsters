import { expect } from 'chai';

import { CamouflageVestCard } from './camouflage-vest.js';
import Minotaur from '../monsters/minotaur.js';

describe('./cards/camouflage-vest.ts', () => {
	it('can be instantiated with defaults', () => {
		const camouflage = new CamouflageVestCard();

		expect(camouflage).to.be.an.instanceof(CamouflageVestCard);
		expect(camouflage.icon).to.equal('☁️');
	});

	it('can be drawn', () => {
		const camouflage = new CamouflageVestCard();

		const monster = new Minotaur({ name: 'player', xp: 50 });

		expect((monster as any).canHoldCard(CamouflageVestCard)).to.equal(true);
		expect((monster as any).canHoldCard(camouflage)).to.equal(true);
	});
});

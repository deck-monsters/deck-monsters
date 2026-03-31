import { expect } from 'chai';

import { TurkeyThighCard } from './turkey-thigh.js';
import { HitCard } from './hit.js';
import { HealCard } from './heal.js';
import { BARBARIAN } from '../constants/creature-classes.js';

describe('./cards/turkey-thigh.ts', () => {
	it('can be instantiated with defaults', () => {
		const turkeyThigh = new TurkeyThighCard();
		const hit = new HitCard({ damageDice: (turkeyThigh as any).damageDice } as any);
		const heal = new HealCard({ healthDice: (turkeyThigh as any).damageDice } as any);

		expect(turkeyThigh).to.be.an.instanceof(TurkeyThighCard);
		expect(turkeyThigh.stats).to.equal(`${hit.stats}\n- or, below 1/4 health -\n${heal.stats}`);
		expect((turkeyThigh as any).permittedClassesAndTypes).to.deep.equal([BARBARIAN]);
		expect(turkeyThigh.icon).to.equal('🍗');
		expect((turkeyThigh as any).damageDice).to.equal('2d4');
	});

	it('can be instantiated with options', () => {
		const turkeyThigh = new TurkeyThighCard({ icon: '🤷‍♂️', damageDice: '1d4' } as any);
		const hit = new HitCard({ damageDice: (turkeyThigh as any).damageDice } as any);
		const heal = new HealCard({ healthDice: (turkeyThigh as any).damageDice } as any);

		expect(turkeyThigh).to.be.an.instanceof(TurkeyThighCard);
		expect(turkeyThigh.stats).to.equal(`${hit.stats}\n- or, below 1/4 health -\n${heal.stats}`);
		expect((turkeyThigh as any).permittedClassesAndTypes).to.deep.equal([BARBARIAN]);
		expect(turkeyThigh.icon).to.equal('🤷‍♂️');
		expect((turkeyThigh as any).damageDice).to.equal('1d4');
	});
});

import { expect } from 'chai';

import { IocaneCard } from './iocane.js';
import { HitCard } from './hit.js';
import { HealCard } from './heal.js';
import { BARD, CLERIC } from '../constants/creature-classes.js';

describe('./cards/iocane.ts', () => {
	it('can be instantiated with defaults', () => {
		const iocane = new IocaneCard();
		const hit = new HitCard({ damageDice: (iocane as any).damageDice });
		const heal = new HealCard({ healthDice: (iocane as any).damageDice } as any);

		expect(iocane).to.be.an.instanceof(IocaneCard);
		expect(iocane.stats).to.equal(`${hit.stats}\n- or, below 1/4 health -\n${heal.stats}`);
		expect((iocane as any).permittedClassesAndTypes).to.deep.equal([BARD, CLERIC]);
		expect(iocane.icon).to.equal('⚗️');
		expect((iocane as any).damageDice).to.equal('2d4');
	});

	it('can be instantiated with options', () => {
		const iocane = new IocaneCard({ icon: '🤷‍♂️', damageDice: '1d4' } as any);
		const hit = new HitCard({ damageDice: (iocane as any).damageDice });
		const heal = new HealCard({ healthDice: (iocane as any).damageDice } as any);

		expect(iocane).to.be.an.instanceof(IocaneCard);
		expect(iocane.stats).to.equal(`${hit.stats}\n- or, below 1/4 health -\n${heal.stats}`);
		expect((iocane as any).permittedClassesAndTypes).to.deep.equal([BARD, CLERIC]);
		expect(iocane.icon).to.equal('🤷‍♂️');
		expect((iocane as any).damageDice).to.equal('1d4');
	});
});

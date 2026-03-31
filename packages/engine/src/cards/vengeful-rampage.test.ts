import { expect } from 'chai';

import { VenegefulRampageCard as VengefulRampageCard } from './vengeful-rampage.js';
import Basilisk from '../monsters/basilisk.js';

describe('./cards/vengeful-rampage.ts', () => {
	it('can be instantiated with defaults', () => {
		const vengefulRampage = new VengefulRampageCard();

		expect(vengefulRampage).to.be.an.instanceof(VengefulRampageCard);
		expect((vengefulRampage as any).probability).to.equal(15);
		expect(vengefulRampage.stats).to.equal('Hit: 1d20 vs ac\nDamage: 1d6 +1 per wound suffered');
	});

	it('deals damage equal to the amount of damage already taken', () => {
		const vengefulRampage = new VengefulRampageCard();

		const player = new Basilisk({ name: 'player', hp: 26, hpVariance: 0 } as any);
		const target = new Basilisk({ name: 'target' });

		const roll = vengefulRampage.getDamageRoll(player, target);

		expect((roll as any).modifier).to.equal(4);
	});

	it('does max damage equal to double player damage modifier', () => {
		const vengefulRampage = new VengefulRampageCard();

		const player = new Basilisk({ name: 'player', hp: 4, hpVariance: 0, strModifier: 6 } as any);
		const target = new Basilisk({ name: 'target' });

		const roll = vengefulRampage.getDamageRoll(player, target);

		expect((roll as any).modifier).to.equal(12);
	});
});

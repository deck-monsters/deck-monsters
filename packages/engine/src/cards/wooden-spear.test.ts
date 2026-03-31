import { expect } from 'chai';

import { WoodenSpearCard } from './wooden-spear.js';
import Basilisk from '../monsters/basilisk.js';
import Minotaur from '../monsters/minotaur.js';

describe('./cards/wooden-spear.ts', () => {
	it('can be instantiated with defaults', () => {
		const woodenSpear = new WoodenSpearCard();

		expect(woodenSpear).to.be.an.instanceof(WoodenSpearCard);
		expect((woodenSpear as any).strModifier).to.equal(3);
		expect(woodenSpear.stats).to.equal('Hit: 1d20 vs ac / Damage: 1d6\n+3 damage vs Minotaur');
	});

	it('can be instantiated with options', () => {
		const woodenSpear = new WoodenSpearCard({ strModifier: 4 } as any);

		expect(woodenSpear).to.be.an.instanceof(WoodenSpearCard);
		expect((woodenSpear as any).strModifier).to.equal(4);
	});

	it('can be played against non-minotaurs', () => {
		const woodenSpear = new WoodenSpearCard();

		const player = new Basilisk({ name: 'player' });
		const target = new Basilisk({ name: 'target' });
		const roll = woodenSpear.getDamageRoll(player, target);

		expect((roll as any).modifier).to.equal(2);
	});

	it('can be played against minotaurs', () => {
		const woodenSpear = new WoodenSpearCard();

		const player = new Basilisk({ name: 'player' });
		const target = new Minotaur({ name: 'target' });
		const roll = woodenSpear.getDamageRoll(player, target);

		expect((roll as any).modifier).to.equal(5);
	});
});

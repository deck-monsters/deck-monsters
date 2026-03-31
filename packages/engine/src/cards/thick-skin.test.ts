import { expect } from 'chai';

import { ThickSkinCard } from './thick-skin.js';
import Basilisk from '../monsters/basilisk.js';

describe('./cards/thick-skin.ts', () => {
	it('can be instantiated with defaults', () => {
		const thickSkin = new ThickSkinCard();

		expect(thickSkin).to.be.an.instanceof(ThickSkinCard);
		expect(thickSkin.icon).to.equal('🔬');
		expect((thickSkin as any).boostAmount).to.equal(2);
		expect((thickSkin as any).boostedProp).to.equal('ac');
		expect(thickSkin.stats).to.equal(
			'Boost: ac +2 (max boost of level * 2, or 1 for beginner, then boost granted to hp instead).\nIf hit by melee attack, damage comes out of ac boost first.'
		);
	});

	it('increases ac', () => {
		const thickSkin = new ThickSkinCard();

		const player = new Basilisk({ name: 'player' });
		const before = (player as any).ac;

		return thickSkin.play(player).then((result: any) => {
			expect(result).to.equal(true);
			expect((player as any).ac).to.be.above(before);
		});
	});
});

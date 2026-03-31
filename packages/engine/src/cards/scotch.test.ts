import { expect } from 'chai';

import { ScotchCard } from './scotch.js';
import { HealCard } from './heal.js';
import Basilisk from '../monsters/basilisk.js';

describe('./cards/scotch.ts', () => {
	it('can be instantiated with defaults', () => {
		const scotch = new ScotchCard();
		const heal = new HealCard({ healthDice: (scotch as any).healthDice } as any);

		expect((scotch as any).probability).to.equal(15);
		expect(scotch.stats).to.equal(heal.stats);
	});

	it('heals the player', () => {
		const scotch = new ScotchCard();

		const player = new Basilisk({ name: 'player', hp: 2 });
		const before = (player as any).hp;

		return scotch.play(player).then((result: any) => {
			expect(result).to.equal(true);
			expect((player as any).hp).to.be.above(before);
		});
	});
});

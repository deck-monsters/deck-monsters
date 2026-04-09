import { expect } from 'chai';
import sinon from 'sinon';

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

		// Stub checkSuccess to guarantee a plain heal (no curseOfLoki / strokeOfLuck)
		// so the test is deterministic rather than relying on random(1,100) !== 13.
		const checkSuccessStub = sinon.stub(HealCard.prototype, 'checkSuccess').returns({
			curseOfLoki: false,
			healRoll: { result: 5 },
			result: 5,
			strokeOfLuck: false,
			success: true,
		});

		return scotch.play(player).then((result: any) => {
			checkSuccessStub.restore();
			expect(result).to.equal(true);
			expect((player as any).hp).to.be.above(before);
		}).catch((err: unknown) => {
			checkSuccessStub.restore();
			throw err;
		});
	});
});

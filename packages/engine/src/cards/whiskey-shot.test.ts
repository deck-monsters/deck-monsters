import { expect } from 'chai';
import sinon from 'sinon';

import { WhiskeyShotCard } from './whiskey-shot.js';
import { HealCard } from './heal.js';
import Basilisk from '../monsters/basilisk.js';

describe('./cards/whiskey-shot.ts', () => {
	it('can be instantiated with defaults', () => {
		const whiskeyShot = new WhiskeyShotCard();
		const heal = new HealCard({ healthDice: (whiskeyShot as any).healthDice } as any);

		expect(whiskeyShot).to.be.an.instanceof(WhiskeyShotCard);
		expect((whiskeyShot as any).healthDice).to.equal('1d8');
		expect((whiskeyShot as any).probability).to.equal(40);
		expect(whiskeyShot.stats).to.equal(heal.stats);
	});

	it('heals the player', () => {
		const whiskeyShot = new WhiskeyShotCard();

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

		return whiskeyShot.play(player).then((result: any) => {
			checkSuccessStub.restore();
			expect(result).to.equal(true);
			expect((player as any).hp).to.be.above(before);
		}).catch((err: unknown) => {
			checkSuccessStub.restore();
			throw err;
		});
	});
});

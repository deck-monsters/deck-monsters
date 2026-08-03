import { expect } from 'chai';
import sinon from 'sinon';

import { BadBatchCard } from './bad-batch.js';
import { ScotchCard } from './scotch.js';
import { HealCard } from './heal.js';
import Jinn from '../monsters/jinn.js';

describe('./cards/bad-batch.ts', () => {
	let channelStub: sinon.SinonStub;

	before(() => {
		channelStub = sinon.stub();
	});

	beforeEach(() => {
		channelStub.resolves();
	});

	afterEach(() => {
		channelStub.reset();
	});

	it('can be instantiated with defaults', () => {
		const badBatch = new BadBatchCard();

		expect(badBatch).to.be.an.instanceof(BadBatchCard);
		expect((badBatch as any).flavors.hits).to.be.an('array');
		expect(badBatch.stats).to.equal('The next Whiskey Shot or Scotch played will poison rather than heal.');
	});

	it('can be played', () => {
		const badBatch = new BadBatchCard();

		const player = new Jinn({ name: 'player' });
		const target1 = new Jinn({ name: 'target1' });
		const target2 = new Jinn({ name: 'target2' });
		const ring: any = {
			encounterEffects: [],
			contestants: [
				{ monster: player },
				{ monster: target1 },
				{ monster: target2 },
			],
		};

		return badBatch.play(player, target1, ring, ring.contestants).then(result => {
			expect(result).to.equal(true);
			expect(ring.encounterEffects.length).to.equal(1);
		});
	});

	it('has an effect', () => {
		const badBatch = new BadBatchCard();

		const player = new Jinn({ name: 'player' });
		const target1 = new Jinn({ name: 'target1' });
		const target2 = new Jinn({ name: 'target2' });
		const ring: any = {
			encounterEffects: [],
			contestants: [
				{ monster: player },
				{ monster: target1 },
				{ monster: target2 },
			],
		};

		const playerStartingHp = 5;
		const target1StartingHp = 5;
		const target2StartingHp = 5;

		player.hp = playerStartingHp;
		target1.hp = target1StartingHp;
		target2.hp = target2StartingHp;

		const scotch = new ScotchCard();

		const checkSuccessStub = sinon.stub(
			Object.getPrototypeOf(Object.getPrototypeOf(Object.getPrototypeOf(scotch))),
			'checkSuccess'
		);
		checkSuccessStub.returns({
			curseOfLoki: false,
			healRoll: {
				primaryDice: '2d6',
				bonusDice: undefined,
				result: 10,
				naturalRoll: { result: 10 },
				bonusResult: 0,
				modifier: 0,
				strokeOfLuck: false,
				curseOfLoki: false,
			},
			result: 10,
			strokeOfLuck: false,
			success: true,
		});

		expect(ring.encounterEffects.length).to.equal(0);

		return scotch
			.play(target1, player)
			.then(() => {
				expect(target1.hp).to.be.above(target1StartingHp);
			})
			.then(() => badBatch.play(player, target1, ring, ring.contestants))
			.then(() => expect(ring.encounterEffects.length).to.equal(1))
			.then(() => ring.encounterEffects[0]({ card: scotch }))
			.then((modifiedCard: any) => modifiedCard.play(target2, player, ring, ring.contestants))
			.then(() => {
				expect(target2.hp).to.be.below(target2StartingHp);
				expect(ring.encounterEffects.length).to.equal(0);
				checkSuccessStub.restore();
			});
	});

	it('has no effect on other cards', () => {
		// Assert on the rewrite Bad Batch performs, not on the resulting hp.
		// HealCard.checkSuccess has 1% Curse of Loki (`result *= -1`) and 1% Stroke
		// of Luck branches, so playing a Heal and expecting hp to go up made this
		// test flake — it failed roughly 1 run in 100 with "expected 3 to be above 5"
		// when the curse turned the heal into 2 points of damage. Bad Batch's actual
		// contract is that a non-target card comes back untouched, which is
		// deterministic and a stronger assertion besides.
		const badBatch = new BadBatchCard();

		const player = new Jinn({ name: 'player' });
		const target1 = new Jinn({ name: 'target1' });
		const ring: any = {
			encounterEffects: [],
			contestants: [
				{ monster: player },
				{ monster: target1 },
			],
		};

		const heal = new HealCard();
		const originalEffect = heal.effect;

		return badBatch
			.play(player, target1, ring, ring.contestants)
			.then(() => expect(ring.encounterEffects.length).to.equal(1))
			.then(() => ring.encounterEffects[0]({ card: heal }))
			.then((modifiedCard: any) => {
				expect(modifiedCard, 'card is returned unchanged').to.equal(heal);
				expect(modifiedCard.effect, 'effect is not rewritten').to.equal(originalEffect);
				// A non-target card must not consume the pending effect — it stays
				// armed for the next Whiskey Shot or Scotch.
				expect(ring.encounterEffects.length, 'effect stays armed').to.equal(1);
			});
	});

	it('can be held by Jinn', () => {
		const player = new Jinn({ name: 'player', xp: 300 });

		expect((player as any).canHold(BadBatchCard)).to.equal(true);
	});
});

import { expect } from 'chai';
import sinon from 'sinon';

import { ATTACK_PHASE } from '../constants/phases.js';
import { randomCardHelpers } from './random.js';
import Jinn from '../monsters/jinn.js';
import { RandomCard } from './random.js';
import { SandstormCard } from './sandstorm.js';
import { TestCard } from './test.js';

describe('./cards/sandstorm.ts', () => {
	it('can be instantiated with defaults', () => {
		const sandstorm = new SandstormCard();

		expect(sandstorm).to.be.an.instanceof(SandstormCard);
		expect((sandstorm as any).hitProbability).to.equal(30);
		expect(sandstorm.stats).to.equal(
			'1 storm damage +1 per level of the jinni to everyone in the ring. Temporarily confuses opponents and causes them to mistake their targets.'
		);
	});

	it('can be played', () => {
		const sandstorm = new SandstormCard();

		const player = new Jinn({ name: 'player' });
		const target1 = new Jinn({ name: 'target1' });
		const target2 = new Jinn({ name: 'target2' });
		const ring: any = {
			contestants: [
				{ character: {}, monster: player },
				{ character: {}, monster: target1 },
				{ character: {}, monster: target2 },
			],
		};

		const playerStartingHp = (player as any).hp;
		const playerLevel = (player as any).level;
		const damage = 1 + 1 * playerLevel;
		const target1StartingHp = (target1 as any).hp;
		const target2StartingHp = (target2 as any).hp;

		return sandstorm.play(player, target1, ring, ring.contestants).then(() => {
			expect((player as any).hp).to.equal(playerStartingHp);
			expect((target1 as any).hp).to.equal(target1StartingHp - damage);
			expect((target2 as any).hp).to.equal(target2StartingHp - damage);
		});
	});

	it('has an effect', () => {
		const sandstorm = new SandstormCard({ hitProbability: 0 } as any);

		const player = new Jinn({ name: 'player' });
		const target1 = new Jinn({ name: 'target1' });
		const target2 = new Jinn({ name: 'target2' });
		const ring: any = {
			contestants: [
				{ character: {}, monster: player },
				{ character: {}, monster: target1 },
				{ character: {}, monster: target2 },
			],
		};

		const card = new TestCard({ targets: [player] });

		expect((sandstorm as any).hitProbability).to.equal(0);
		expect((target1 as any).encounterEffects.length).to.equal(0);
		expect((target2 as any).encounterEffects.length).to.equal(0);

		return card
			.play(target1, player)
			.then(() => {
				expect((target1 as any).played).to.equal(1);
				expect((player as any).targeted).to.equal(1);
			})
			.then(() => sandstorm.play(player, target1, ring, ring.contestants))
			.then(() =>
				(target1 as any).encounterEffects[0]({ card, phase: ATTACK_PHASE, player: target1 })
			)
			.then((modifiedCard: any) => modifiedCard.play(target1, player, ring, ring.contestants))
			.then(() => {
				expect((target1 as any).played).to.equal(2);
				expect((player as any).targeted).to.equal(1);
				expect(
					((target1 as any).targeted || 0) + ((target2 as any).targeted || 0)
				).to.equal(1);

				expect((target1 as any).encounterEffects.length).to.equal(0);
				expect((target2 as any).encounterEffects.length).to.equal(1);
			});
	});

	it('works with random cards', () => {
		const attack = new TestCard();
		const drawStub = sinon.stub();
		randomCardHelpers.draw = drawStub as any;
		const sandstorm = new SandstormCard({ healProbability: 100, hitProbability: 0 } as any);
		const heal = new TestCard();
		const random = new RandomCard();

		const player = new Jinn({ name: 'player' });
		const target1 = new Jinn({ name: 'target1' });
		const target2 = new Jinn({ name: 'target2' });
		const ring: any = {
			contestants: [
				{ character: {}, monster: player },
				{ character: {}, monster: target1 },
				{ character: {}, monster: target2 },
			],
		};

		expect((target1 as any).encounterEffects.length).to.equal(0);
		expect((target2 as any).encounterEffects.length).to.equal(0);

		(heal as any).getTargets = (cardPlayer: any) => [cardPlayer];

		drawStub.onFirstCall().returns(heal);
		drawStub.onSecondCall().returns(attack);

		return sandstorm
			.play(player, target1, ring, ring.contestants)
			.then(() => random.clone().play(target1, player, ring, ring.contestants))
			.then(() => {
				expect((target1 as any).played).to.equal(1);
				expect((target1 as any).targeted).to.equal(undefined);
				expect((player as any).targeted).to.equal(1);
			})
			.then(() => random.clone().play(target2, player, ring, ring.contestants))
			.then(() => {
				randomCardHelpers.draw = undefined;

				expect((target1 as any).played).to.equal(1);
				expect((target2 as any).played).to.equal(1);
				expect((player as any).targeted).to.equal(1);
				expect(
					((target1 as any).targeted || 0) + ((target2 as any).targeted || 0)
				).to.equal(1);

				expect((target1 as any).encounterEffects.length).to.equal(0);
				expect((target2 as any).encounterEffects.length).to.equal(0);
			});
	});

	it('has hit flavors', () => {
		const sandstorm = new SandstormCard();

		expect((sandstorm as any).flavors.hits).to.be.an('array');
	});
});

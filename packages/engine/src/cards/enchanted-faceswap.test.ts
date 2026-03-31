import { expect } from 'chai';
import sinon from 'sinon';

import { DEFENSE_PHASE } from '../constants/phases.js';
import Basilisk from '../monsters/basilisk.js';
import { EnchantedFaceswapCard } from './enchanted-faceswap.js';
import { RandomCard, randomCardHelpers } from './random.js';
import { TestCard } from './test.js';
import WeepingAngel from '../monsters/weeping-angel.js';

describe('./cards/enchanted-faceswap.ts', () => {
	it('can be instantiated with defaults', () => {
		const faceswap = new EnchantedFaceswapCard();

		expect(faceswap).to.be.an.instanceof(EnchantedFaceswapCard);
		expect(faceswap.icon).to.equal('👥');
	});

	it('can be drawn', () => {
		const faceswap = new EnchantedFaceswapCard();

		const monster = new WeepingAngel({ name: 'player', xp: 50 });

		expect((monster as any).canHoldCard(EnchantedFaceswapCard)).to.equal(true);
		expect((monster as any).canHoldCard(faceswap)).to.equal(true);
	});

	it('can be played', () => {
		const faceswap = new EnchantedFaceswapCard();

		const player = new Basilisk({ name: 'player' });
		const target = new Basilisk({ name: 'target' });

		expect((player as any).encounterEffects.length).to.equal(0);

		return faceswap.play(player, target).then(() => {
			expect((player as any).encounterEffects.length).to.equal(1);
		});
	});

	it('has an effect', () => {
		const faceswap = new EnchantedFaceswapCard();
		const card = new TestCard();

		const player = new Basilisk({ name: 'player' });
		const target = new Basilisk({ name: 'target' });

		expect((player as any).encounterEffects.length).to.equal(0);

		return card
			.play(target, player)
			.then(() => {
				expect((target as any).played).to.equal(1);
				expect((player as any).targeted).to.equal(1);
			})
			.then(() => faceswap.play(player, target))
			.then(() => (player as any).encounterEffects[0]({ card, phase: 'Not DEFENSE_PHASE', player: target }))
			.then((modifiedCard: any) =>
				(player as any).encounterEffects[0]({ card: modifiedCard, phase: DEFENSE_PHASE, player: target })
			)
			.then((modifiedCard: any) => modifiedCard.play(target, player))
			.then(() => {
				expect((target as any).targeted).to.equal(1);
				expect((player as any).played).to.equal(1);
				expect((player as any).encounterEffects.length).to.equal(0);
			});
	});

	it('works with random cards', () => {
		const attack = new TestCard();
		const drawStub = sinon.stub();
		const faceswap = new EnchantedFaceswapCard();
		const heal = new TestCard();
		const random = new RandomCard();
		randomCardHelpers.draw = drawStub as any;

		const player = new Basilisk({ name: 'player' });
		const target = new Basilisk({ name: 'target' });

		expect((player as any).encounterEffects.length).to.equal(0);

		(heal as any).getTargets = (cardPlayer: any) => [cardPlayer];

		drawStub.onFirstCall().returns(heal);
		drawStub.onSecondCall().returns(attack);

		const ring: any = {
			contestants: [
				{ character: {}, monster: player },
				{ character: {}, monster: target },
			],
			channelManager: { sendMessages: () => Promise.resolve() },
		};

		return faceswap
			.play(player, target, ring, ring.contestants)
			.then(() => random.play(target, player, ring, ring.contestants))
			.then(() => random.play(target, player, ring, ring.contestants))
			.then(() => {
				randomCardHelpers.draw = undefined;

				expect((target as any).targeted).to.equal(2);
				expect((player as any).targeted).to.equal(undefined);
				expect((target as any).played).to.equal(1);
				expect((player as any).played).to.equal(1);
				expect((player as any).encounterEffects.length).to.equal(0);
			});
	});
});

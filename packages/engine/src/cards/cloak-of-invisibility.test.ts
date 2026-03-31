import { expect } from 'chai';

import { ATTACK_PHASE, DEFENSE_PHASE } from '../constants/phases.js';
import Basilisk from '../monsters/basilisk.js';
import { CloakOfInvisibilityCard } from './cloak-of-invisibility.js';
import { TestCard } from './test.js';
import WeepingAngel from '../monsters/weeping-angel.js';

describe('./cards/cloak-of-invisibility.ts', () => {
	it('can be instantiated with defaults', () => {
		const invisibility = new CloakOfInvisibilityCard();

		expect(invisibility).to.be.an.instanceof(CloakOfInvisibilityCard);
		expect(invisibility.icon).to.equal('☁️');
		expect(invisibility.stats).to.equal(
			'You are invisible until you play a card that targets another player, or for the next 2 cards you play (whichever comes first).\n1d20 vs your int for opponent to see you on their turn (natural 20 removes your cloak).'
		);
	});

	it('can be drawn', () => {
		const invisibility = new CloakOfInvisibilityCard();

		const monster = new WeepingAngel({ name: 'player', xp: 50 });

		expect((monster as any).canHoldCard(CloakOfInvisibilityCard)).to.equal(true);
		expect((monster as any).canHoldCard(invisibility)).to.equal(true);
	});

	it('can be played', () => {
		const invisibility = new CloakOfInvisibilityCard();

		const player = new WeepingAngel({ name: 'player' });
		const target = new Basilisk({ name: 'target' });

		expect((player as any).encounterEffects.length).to.equal(0);

		return invisibility.play(player, target).then(() => {
			expect((player as any).encounterEffects.length).to.equal(1);
		});
	});

	it('has an effect', () => {
		const invisibility = new CloakOfInvisibilityCard();
		const card = new TestCard();

		const player = new WeepingAngel({ name: 'player' });
		const target = new Basilisk({ name: 'target' });
		const ring: any = {
			contestants: [{ monster: player }, { monster: target }],
		};

		(invisibility as any).checkSuccess = () => ({ strokeOfLuck: false, curseOfLoki: false, success: false });

		expect((player as any).encounterEffects.length).to.equal(0);

		return card
			.play(target, player, ring, ring.contestants)
			.then(() => {
				expect((target as any).played).to.equal(1);
				expect((player as any).targeted).to.equal(1);
			})
			.then(() => invisibility.play(player, target, ring, ring.contestants))
			.then(() => (player as any).encounterEffects[0]({ card, phase: ATTACK_PHASE, player: target, target: player }))
			.then((modifiedCard: any) =>
				(player as any).encounterEffects[0]({ card: modifiedCard, phase: DEFENSE_PHASE, player: target, target: player })
			)
			.then((modifiedCard: any) => modifiedCard.play(target, player, ring, ring.contestants))
			.then(() => {
				expect((target as any).played).to.equal(1);
				expect((player as any).targeted).to.equal(1);
				expect((player as any).encounterEffects.length).to.equal(1);
			})
			.then(() => (player as any).encounterEffects[0]({ card, phase: ATTACK_PHASE, player, target }))
			.then((modifiedCard: any) =>
				(player as any).encounterEffects[0]({ card: modifiedCard, phase: DEFENSE_PHASE, player, target })
			)
			.then((modifiedCard: any) => modifiedCard.play(player, player, ring, ring.contestants))
			.then(() => {
				expect((target as any).played).to.equal(1);
				expect((player as any).targeted).to.equal(2);
				expect((player as any).played).to.equal(1);
				expect((player as any).encounterEffects.length).to.equal(1);
			})
			.then(() => (player as any).encounterEffects[0]({ card, phase: ATTACK_PHASE, player, target }))
			.then((modifiedCard: any) =>
				(player as any).encounterEffects[0]({ card: modifiedCard, phase: DEFENSE_PHASE, player, target })
			)
			.then((modifiedCard: any) => modifiedCard.play(player, target, ring, ring.contestants))
			.then(() => {
				expect((target as any).played).to.equal(1);
				expect((player as any).targeted).to.equal(2);
				expect((player as any).played).to.equal(2);
				expect((target as any).targeted).to.equal(1);
				expect((player as any).encounterEffects.length).to.equal(0);
			});
	});
});

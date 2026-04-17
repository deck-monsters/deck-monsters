import { expect } from 'chai';
import sinon from 'sinon';

import { HitCard } from './hit.js';
import Basilisk from '../monsters/basilisk.js';
import Minotaur from '../monsters/minotaur.js';
import { CoilCard } from './coil.js';
import { ATTACK_PHASE } from '../constants/phases.js';
import { GLADIATOR, MINOTAUR, BASILISK, JINN } from '../constants/creature-types.js';

describe('./cards/coil.ts', () => {
	it('can be instantiated with defaults', () => {
		const coil = new CoilCard();
		const hit = new HitCard({ targetProp: (coil as any).targetProp });

		const stats = `Immobilize and hit your opponent by coiling your serpentine body around them and squeezing. If opponent is immune, hit instead.

If already immobilized, hit instead.
${hit.stats}
 +2 advantage vs Gladiator, Minotaur
 -2 disadvantage vs Basilisk, Jinn

Opponent breaks free by rolling 1d20 vs immobilizer's dex +/- advantage/disadvantage - (turns immobilized * 3)
Hits immobilizer back on stroke of luck.
Turns immobilized resets on curse of loki.

-1 hp each turn immobilized.`;

		expect(coil).to.be.an.instanceof(CoilCard);
		expect((coil as any).freedomThresholdModifier).to.equal(2);
		expect((coil as any).freedomSavingThrowTargetAttr).to.equal('dex');
		expect((coil as any).targetProp).to.equal('dex');
		expect((coil as any).doDamageOnImmobilize).to.be.true;
		expect((coil as any).ongoingDamage).to.equal(1);
		expect(coil.stats).to.equal(stats);
		expect((coil as any).strongAgainstCreatureTypes).to.deep.equal([GLADIATOR, MINOTAUR]);
		expect((coil as any).weakAgainstCreatureTypes).to.deep.equal([BASILISK, JINN]);
		expect((coil as any).uselessAgainstCreatureTypes).to.deep.equal([]);
		expect((coil as any).permittedClassesAndTypes).to.deep.equal([BASILISK]);
	});

	it('can be instantiated with options', () => {
		const coil = new CoilCard({ freedomThresholdModifier: 2, doDamageOnImmobilize: false, ongoingDamage: 0 } as any);

		expect(coil).to.be.an.instanceof(CoilCard);
		expect((coil as any).freedomThresholdModifier).to.equal(2);
		expect((coil as any).doDamageOnImmobilize).to.be.false;
		expect((coil as any).ongoingDamage).to.equal(0);
	});

	it('does ongoingDamage until opponent breaks free', () => {
		const coil = new CoilCard();
		const checkSuccessStub = sinon.stub(
			Object.getPrototypeOf(Object.getPrototypeOf(Object.getPrototypeOf(coil))),
			'checkSuccess'
		);
		const hitCheckStub = sinon.stub(Object.getPrototypeOf(Object.getPrototypeOf(coil)), 'hitCheck');

		const player = new Basilisk({ name: 'player' });
		const target = new Minotaur({ name: 'target' });
		const startingTargetHP = (target as any).hp;
		const startingPlayerHP = (player as any).hp;

		const ring: any = {
			contestants: [{ monster: player }, { monster: target }],
			channelManager: { sendMessages: () => Promise.resolve() },
		};

		checkSuccessStub.returns({ success: true, strokeOfLuck: false, curseOfLoki: false });

		const attackRoll = (coil as any).getAttackRoll(player, target);
		hitCheckStub.returns({ attackRoll, success: true, strokeOfLuck: false, curseOfLoki: false });

		let ongoingHP = startingTargetHP;

		return coil
			.play(player, target, ring, ring.contestants)
			.then(async () => {
				expect((target as any).encounterEffects.length).to.equal(1);
				expect((target as any).hp).to.be.below(startingTargetHP);
				ongoingHP = (target as any).hp;
				expect((player as any).hp).to.equal(startingPlayerHP);

				checkSuccessStub.returns({ success: false, strokeOfLuck: false, curseOfLoki: false });

				let card = new HitCard();
				for (const effect of (target as any).encounterEffects) {
					const modifiedCard = await effect({
						activeContestants: [target, player],
						card,
						phase: ATTACK_PHASE,
						player,
						ring,
						target,
					});
					card = modifiedCard || card;
				}

				return card.play(target, player, ring, ring.contestants).then(async () => {
					expect((target as any).hp).to.equal(ongoingHP - 1);
					ongoingHP = (target as any).hp;
					expect((player as any).hp).to.equal(startingPlayerHP);
					expect((target as any).encounterEffects.length).to.equal(1);

					checkSuccessStub.returns({ success: true, strokeOfLuck: false, curseOfLoki: false });

					let newcard = new HitCard();
					for (const effect of (target as any).encounterEffects) {
						const modifiedCard = await effect({
							activeContestants: [target, player],
							card: newcard,
							phase: ATTACK_PHASE,
							player,
							ring,
							target,
						});
						newcard = modifiedCard || newcard;
					}

					return newcard.play(target, player, ring, ring.contestants).then(() => {
						checkSuccessStub.restore();
						hitCheckStub.restore();

						expect((target as any).hp).to.equal(ongoingHP);
						expect((target as any).encounterEffects.length).to.equal(0);
					});
				});
			});
	});
});

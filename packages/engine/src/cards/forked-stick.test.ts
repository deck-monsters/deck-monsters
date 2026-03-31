import { expect } from 'chai';
import sinon from 'sinon';

import { HitCard } from './hit.js';
import WeepingAngel from '../monsters/weeping-angel.js';
import Basilisk from '../monsters/basilisk.js';
import Minotaur from '../monsters/minotaur.js';
import Gladiator from '../monsters/gladiator.js';
import { ForkedStickCard } from './forked-stick.js';
import { BARD, FIGHTER, BARBARIAN } from '../constants/creature-classes.js';
import { GLADIATOR, JINN, MINOTAUR, BASILISK } from '../constants/creature-types.js';
import { ATTACK_PHASE } from '../constants/phases.js';

describe('./cards/forked-stick.ts', () => {
	it('can be instantiated with defaults', () => {
		const forkedStick = new ForkedStickCard();
		const hit = new HitCard({ targetProp: (forkedStick as any).targetProp, damageDice: (forkedStick as any).damageDice });

		const stats = `Attempt to immobilize your opponent by pinning them between the branches of a forked stick.

Chance to immobilize: 1d20 vs str.
If already immobilized, hit instead.
${hit.stats}
 +2 advantage vs Basilisk, Gladiator
 -2 disadvantage vs Jinn, Minotaur
ineffective against Weeping Angel

Opponent breaks free by rolling 1d20 vs immobilizer's str +/- advantage/disadvantage - (turns immobilized * 3)
Hits immobilizer back on stroke of luck.
Turns immobilized resets on curse of loki.
`;

		expect(forkedStick).to.be.an.instanceof(ForkedStickCard);
		expect((forkedStick as any).freedomThresholdModifier).to.equal(2);
		expect((forkedStick as any).freedomSavingThrowTargetAttr).to.equal('str');
		expect((forkedStick as any).targetProp).to.equal('dex');
		expect((forkedStick as any).doDamageOnImmobilize).to.be.true;
		expect((forkedStick as any).damageDice).to.equal('1d4');
		expect(forkedStick.stats).to.equal(stats);
		expect((forkedStick as any).strongAgainstCreatureTypes).to.deep.equal([BASILISK, GLADIATOR]);
		expect((forkedStick as any).weakAgainstCreatureTypes).to.deep.equal([JINN, MINOTAUR]);
		expect((forkedStick as any).permittedClassesAndTypes).to.deep.equal([BARD, BARBARIAN, FIGHTER]);
	});

	it('can be instantiated with options', () => {
		const forkedStick = new ForkedStickCard({ freedomThresholdModifier: 1, doDamageOnImmobilize: false } as any);

		expect(forkedStick).to.be.an.instanceof(ForkedStickCard);
		expect((forkedStick as any).freedomThresholdModifier).to.equal(1);
		expect((forkedStick as any).doDamageOnImmobilize).to.be.false;
	});

	it('calculates freedom threshold correctly', () => {
		const forkedStick = new ForkedStickCard();
		const player = new Minotaur({ name: 'player' });

		expect((forkedStick as any).getFreedomThreshold(player, player)).to.equal(5);
	});

	it('can be played against gladiators for a bonus to attack', () => {
		const forkedStick = new ForkedStickCard();

		const player = new Minotaur({ name: 'player' });
		const target = new Gladiator({ name: 'target' });
		const atkRoll = (forkedStick as any).getAttackRoll(player, target);
		const dmgRoll = (forkedStick as any).getDamageRoll(player, target);

		expect(atkRoll.modifier).to.equal((player as any).dexModifier + 2);
		expect(dmgRoll.modifier).to.equal((player as any).strModifier);
	});

	it('can be played against basilisk for a bonus to attack', () => {
		const forkedStick = new ForkedStickCard();

		const player = new Minotaur({ name: 'player' });
		const target = new Basilisk({ name: 'target' });
		const atkRoll = (forkedStick as any).getAttackRoll(player, target);
		const dmgRoll = (forkedStick as any).getDamageRoll(player, target);

		expect(atkRoll.modifier).to.equal((player as any).dexModifier + 2);
		expect(dmgRoll.modifier).to.equal((player as any).strModifier);
	});

	it('can be played against minotaurs for a weakened attack', () => {
		const forkedStick = new ForkedStickCard();

		const player = new Gladiator({ name: 'player' });
		const target = new Minotaur({ name: 'target' });
		const atkRoll = (forkedStick as any).getAttackRoll(player, target);
		const dmgRoll = (forkedStick as any).getDamageRoll(player, target);

		expect(atkRoll.modifier).to.equal((player as any).dexModifier - 2);
		expect(dmgRoll.modifier).to.equal((player as any).strModifier);
	});

	it('can be played against weeping angel with no bonus/penalty', () => {
		const forkedStick = new ForkedStickCard();

		const target = new WeepingAngel({ name: 'player' });
		const player = new Gladiator({ name: 'target' });
		const dmgRoll = (forkedStick as any).getDamageRoll(player, target);
		const atkRoll = (forkedStick as any).getAttackRoll(player, target);

		expect(dmgRoll.modifier).to.equal((player as any).strModifier);
		expect(atkRoll.modifier).to.equal((player as any).dexModifier);
	});

	it('immobilizes basilisk on hit', () => {
		const forkedStick = new ForkedStickCard();
		const checkSuccessStub = sinon.stub(
			Object.getPrototypeOf(Object.getPrototypeOf(forkedStick)),
			'checkSuccess'
		);

		const player = new Minotaur({ name: 'player' });
		const target = new Basilisk({ name: 'target' });
		const before = (target as any).hp;

		const ring: any = {
			contestants: [{ character: {}, monster: player }, { character: {}, monster: target }],
			channelManager: { sendMessages: () => Promise.resolve() },
		};

		checkSuccessStub.returns({ success: true, strokeOfLuck: false, curseOfLoki: false });

		return forkedStick
			.play(player, target, ring, ring.contestants)
			.then(() => {
				expect((target as any).hp).to.be.below(before);
				expect((target as any).encounterEffects[0].effectType).to.equal('ImmobilizeEffect');

				checkSuccessStub.returns({ success: false, strokeOfLuck: false, curseOfLoki: false });

				const hit = new HitCard();
				return hit.play(target, player, ring, ring.contestants).then(() => {
					checkSuccessStub.restore();
					expect((target as any).encounterEffects[0].effectType).to.equal('ImmobilizeEffect');
				});
			});
	});

	it('do damage instead of immobilizing weeping angel on hit', () => {
		const forkedStick = new ForkedStickCard();
		const checkSuccessStub = sinon.stub(
			Object.getPrototypeOf(Object.getPrototypeOf(forkedStick)),
			'checkSuccess'
		);

		const player = new Minotaur({ name: 'player' });
		const target = new WeepingAngel({ name: 'target' });
		const before = (target as any).hp;

		const ring: any = {
			contestants: [{ character: {}, monster: player }, { character: {}, monster: target }],
			channelManager: { sendMessages: () => Promise.resolve() },
		};

		checkSuccessStub.returns({ success: true, strokeOfLuck: false, curseOfLoki: false });

		return forkedStick.play(player, target, ring, ring.contestants).then(() => {
			checkSuccessStub.restore();

			expect((target as any).hp).to.be.below(before);
			expect((target as any).encounterEffects.length).to.equal(0);
		});
	});

	it('lowers freedomThreshold each turn a target is pinned', () => {
		const forkedStick = new ForkedStickCard();
		const checkSuccessStub = sinon.stub(
			Object.getPrototypeOf(Object.getPrototypeOf(Object.getPrototypeOf(forkedStick))),
			'checkSuccess'
		);

		const player = new Minotaur({ name: 'player', acVariance: 0 });
		const target = new Basilisk({ name: 'target', acVariance: 0 });

		const ring: any = {
			contestants: [{ character: {}, monster: player }, { character: {}, monster: target }],
			channelManager: { sendMessages: () => Promise.resolve() },
		};

		checkSuccessStub.returns({ success: true, strokeOfLuck: false, curseOfLoki: false });

		return forkedStick
			.play(player, target, ring, ring.contestants)
			.then(() => {
				expect((target as any).encounterEffects[0].effectType).to.equal('ImmobilizeEffect');

				checkSuccessStub.returns({ success: false, strokeOfLuck: false, curseOfLoki: false });

				expect((forkedStick as any).getFreedomThreshold(player, target)).to.equal(9);

				const card = (target as any).encounterEffects.reduce((currentCard: any, effect: any) => {
					const modifiedCard = effect({
						activeContestants: [target, player],
						card: currentCard,
						phase: ATTACK_PHASE,
						player,
						ring,
						target,
					});
					return modifiedCard || currentCard;
				}, new HitCard());

				return card.play(target, player, ring, ring.contestants).then(() => {
					expect((forkedStick as any).getFreedomThreshold(player, target)).to.equal(6);
					checkSuccessStub.restore();
					expect((target as any).encounterEffects.length).to.equal(1);
				});
			});
	});

	it('allows immobilized opponents to break free', () => {
		const forkedStick = new ForkedStickCard();
		const checkSuccessStub = sinon.stub(
			Object.getPrototypeOf(Object.getPrototypeOf(forkedStick)),
			'checkSuccess'
		);

		const forkedStickProto = Object.getPrototypeOf(forkedStick);
		const immobilizeProto = Object.getPrototypeOf(forkedStickProto);
		const hitProto = Object.getPrototypeOf(immobilizeProto);
		const getAttackRollImmobilizeSpy = sinon.spy(immobilizeProto, 'getAttackRoll');
		const getImmobilizeRollImmobilizeSpy = sinon.spy(immobilizeProto, 'getImmobilizeRoll');
		const getFreedomRollImmobilizeSpy = sinon.spy(immobilizeProto, 'getFreedomRoll');
		const getAttackRollHitSpy = sinon.spy(hitProto, 'getAttackRoll');

		const player = new Minotaur({ name: 'player' });
		const target = new Basilisk({ name: 'target' });

		const ring: any = {
			contestants: [{ character: {}, monster: player }, { character: {}, monster: target }],
			channelManager: { sendMessages: () => Promise.resolve() },
		};

		checkSuccessStub.returns({ success: true, strokeOfLuck: false, curseOfLoki: false });

		return forkedStick
			.play(player, target, ring, ring.contestants)
			.then(() => {
				expect((target as any).encounterEffects[0].effectType).to.equal('ImmobilizeEffect');
				expect(getAttackRollImmobilizeSpy.callCount).to.equal(1);
				expect(getFreedomRollImmobilizeSpy.callCount).to.equal(0);
				expect(getImmobilizeRollImmobilizeSpy.callCount).to.equal(1);
				expect(getAttackRollHitSpy.callCount).to.equal(0);

				const card = (target as any).encounterEffects.reduce((currentCard: any, effect: any) => {
					const modifiedCard = effect({
						activeContestants: [target, player],
						card: currentCard,
						phase: ATTACK_PHASE,
						player,
						ring,
						target,
					});
					return modifiedCard || currentCard;
				}, new HitCard());

				return card.play(target, player, ring, ring.contestants).then(() => {
					expect(getAttackRollImmobilizeSpy.callCount).to.equal(1);
					expect(getFreedomRollImmobilizeSpy.callCount).to.equal(1);
					expect(getImmobilizeRollImmobilizeSpy.callCount).to.equal(1);
					expect(getAttackRollHitSpy.callCount).to.equal(1);

					checkSuccessStub.restore();
					getAttackRollImmobilizeSpy.restore();
					getFreedomRollImmobilizeSpy.restore();
					getAttackRollHitSpy.restore();

					expect((target as any).encounterEffects.length).to.equal(0);
				});
			});
	});

	it('frees target if player dies between turns', () => {
		const forkedStick = new ForkedStickCard();
		const checkSuccessStub = sinon.stub(
			Object.getPrototypeOf(Object.getPrototypeOf(forkedStick)),
			'checkSuccess'
		);

		const player = new Minotaur({ name: 'player' });
		const target = new Basilisk({ name: 'target' });

		const ring: any = {
			contestants: [{ character: {}, monster: player }, { character: {}, monster: target }],
			channelManager: { sendMessages: () => Promise.resolve() },
		};

		checkSuccessStub.returns({ success: true, strokeOfLuck: false, curseOfLoki: false });

		return forkedStick
			.play(player, target, ring, ring.contestants)
			.then(() => {
				expect((target as any).encounterEffects[0].effectType).to.equal('ImmobilizeEffect');

				checkSuccessStub.returns({ success: false, strokeOfLuck: false, curseOfLoki: false });
				(player as any).dead = true;

				const card = (target as any).encounterEffects.reduce((currentCard: any, effect: any) => {
					const modifiedCard = effect({
						activeContestants: [target, player],
						card: currentCard,
						phase: ATTACK_PHASE,
						player,
						ring,
						target,
					});
					return modifiedCard || currentCard;
				}, new HitCard());

				return card.play(target, player, ring, ring.contestants).then(() => {
					checkSuccessStub.restore();
					expect((target as any).encounterEffects.length).to.equal(0);
				});
			});
	});
});

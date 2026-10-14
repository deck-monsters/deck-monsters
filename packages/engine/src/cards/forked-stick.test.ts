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

describe('./cards/forked-stick.ts Forked Stick', () => {
	it('can be instantiated with defaults', () => {
		const forkedStick = new ForkedStickCard();
		const hit = new HitCard({ targetProp: (forkedStick as any).targetProp, damageDice: (forkedStick as any).damageDice });

		const stats = `Attempt to immobilize your opponent by pinning them between the branches of a forked stick.

Chance to immobilize: 1d20 + str vs dex. On a natural 1 they jab it back at you.
If already immobilized, hit instead.
${hit.stats}
 +2 advantage vs Basilisk, Gladiator
 no modifier vs Dragon, Unicorn
 -2 disadvantage vs Jinn, Minotaur
ineffective against Weeping Angel

Opponent breaks free by rolling 1d20 + their str vs immobilizer's str +/- advantage/disadvantage - (turns immobilized * 3)
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
			.then(async () => {
				expect((target as any).encounterEffects[0].effectType).to.equal('ImmobilizeEffect');

				checkSuccessStub.returns({ success: false, strokeOfLuck: false, curseOfLoki: false });

				expect((forkedStick as any).getFreedomThreshold(player, target)).to.equal(9);

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
			.then(async () => {
				expect((target as any).encounterEffects[0].effectType).to.equal('ImmobilizeEffect');
				expect(getAttackRollImmobilizeSpy.callCount).to.equal(1);
				expect(getFreedomRollImmobilizeSpy.callCount).to.equal(0);
				expect(getImmobilizeRollImmobilizeSpy.callCount).to.equal(1);
				expect(getAttackRollHitSpy.callCount).to.equal(0);

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

				return card.play(target, player, ring, ring.contestants).then(() => {
					expect(getAttackRollImmobilizeSpy.callCount).to.equal(1);
					expect(getFreedomRollImmobilizeSpy.callCount).to.equal(1);
					expect(getImmobilizeRollImmobilizeSpy.callCount).to.equal(1);
					expect(getAttackRollHitSpy.callCount).to.equal(1);

					checkSuccessStub.restore();
					getAttackRollImmobilizeSpy.restore();
					getFreedomRollImmobilizeSpy.restore();
					getImmobilizeRollImmobilizeSpy.restore();
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
			.then(async () => {
				expect((target as any).encounterEffects[0].effectType).to.equal('ImmobilizeEffect');

				checkSuccessStub.returns({ success: false, strokeOfLuck: false, curseOfLoki: false });
				(player as any).dead = true;

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

				return card.play(target, player, ring, ring.contestants).then(() => {
					checkSuccessStub.restore();
					expect((target as any).encounterEffects.length).to.equal(0);
				});
			});
	});

	it('applies a temporary STR change once to immobilize and freedom rolls', () => {
		const forkedStick = new ForkedStickCard();
		const player = new Minotaur({ name: 'player' });
		const target = new Basilisk({ name: 'target' });
		const immobilizeBefore = (forkedStick as any).getImmobilizeRoll(player, target).modifier;
		const freedomBefore = (forkedStick as any).getFreedomRoll(player, target).modifier;

		(player as any).setModifier('str', 1);
		(target as any).setModifier('str', -1);

		expect((forkedStick as any).getImmobilizeRoll(player, target).modifier).to.equal(
			immobilizeBefore + 1
		);
		expect((forkedStick as any).getFreedomRoll(player, target).modifier).to.equal(
			freedomBefore - 1
		);
	});

	it('is jabbed back at its holder on a natural 1 (roadmap 51)', async () => {
		const forkedStick = new ForkedStickCard();
		const player = new Minotaur({ name: 'player' });
		const target = new Basilisk({ name: 'target' });
		const ring: any = {
			contestants: [{ character: {}, monster: player }, { character: {}, monster: target }],
			channelManager: { sendMessages: () => Promise.resolve() },
		};
		const rollStub = sinon.stub(forkedStick, 'getImmobilizeRoll').returns({
			primaryDice: '1d20',
			result: 1,
			naturalRoll: { rolled: [1], result: 1 },
			bonusResult: 0,
			modifier: 0,
			curseOfLoki: true,
			strokeOfLuck: false,
		});
		const narrations: string[] = [];
		forkedStick.on('narration', (_c: unknown, _card: unknown, { narration }: any) => narrations.push(narration));
		const playerHp = (player as any).hp;
		const targetHp = (target as any).hp;

		await forkedStick.play(player, target, ring, ring.contestants);
		rollStub.restore();

		expect((player as any).hp).to.be.below(playerHp);
		expect((target as any).hp).to.equal(targetHp);
		expect((target as any).encounterEffects).to.have.length(0);
		expect(narrations.join(' ')).to.contain(`${target.givenName} wrenches the branch away and jabs it back at ${player.givenName}.`);
	});

	it('jabs a confused holder that aimed it at itself on a natural 1 (PR #434 review)', async () => {
		const forkedStick = new ForkedStickCard();
		const player = new Minotaur({ name: 'player' });
		const ring: any = {
			contestants: [{ character: {}, monster: player }],
			channelManager: { sendMessages: () => Promise.resolve() },
		};
		const rollStub = sinon.stub(forkedStick, 'getImmobilizeRoll').returns({
			primaryDice: '1d20', result: 1, naturalRoll: { rolled: [1], result: 1 }, bonusResult: 0, modifier: 0,
			curseOfLoki: true, strokeOfLuck: false,
		});
		const narrations: string[] = [];
		forkedStick.on('narration', (_c: unknown, _card: unknown, { narration }: any) => narrations.push(narration));
		const hp = (player as any).hp;

		await forkedStick.play(player, player, ring, ring.contestants);
		rollStub.restore();

		expect((player as any).hp).to.be.below(hp);
		expect(narrations.join(' ')).to.contain(`${player.givenName} fumbles the branch and jabs`);
	});
});

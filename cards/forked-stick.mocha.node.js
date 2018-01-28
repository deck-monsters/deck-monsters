const { expect, sinon } = require('../shared/test-setup');

const Hit = require('./hit');
const WeepingAngel = require('../monsters/weeping-angel');
const Basilisk = require('../monsters/basilisk');
const Minotaur = require('../monsters/minotaur');
const Gladiator = require('../monsters/gladiator');
const ForkedStick = require('./forked-stick');
const pause = require('../helpers/pause');

const { BARD, FIGHTER, BARBARIAN } = require('../helpers/classes');
const { GLADIATOR, JINN, MINOTAUR, BASILISK } = require('../helpers/creature-types');
const { ATTACK_PHASE } = require('../helpers/phases');

describe('./cards/forked-stick.js', () => {
	let channelStub;
	let pauseStub;

	before(() => {
		channelStub = sinon.stub();
		pauseStub = sinon.stub(pause, 'setTimeout');
	});

	beforeEach(() => {
		channelStub.resolves();
		pauseStub.callsArg(0);
	});

	afterEach(() => {
		channelStub.reset();
		pauseStub.reset();
	});

	after(() => {
		pause.setTimeout.restore();
	});

	it('can be instantiated with defaults', () => {
		const forkedStick = new ForkedStick();
		const hit = new Hit();

		const stats = `${hit.stats}

 +2 against Basilisk, Gladiator
 -2 against Jinn, Minotaur
inneffective against Weeping Angel
Attempt to pin your opponent between the branches of a forked stick.`;

		expect(forkedStick).to.be.an.instanceof(ForkedStick);
		expect(forkedStick.freedomThresholdModifier).to.equal(2);
		expect(forkedStick.dexModifier).to.equal(2);
		expect(forkedStick.strModifier).to.equal(0);
		expect(forkedStick.doDamageOnImmobilize).to.be.false;
		expect(forkedStick.stats).to.equal(stats);
		expect(forkedStick.strongAgainstCreatureTypes).to.deep.equal([BASILISK, GLADIATOR]);
		expect(forkedStick.weakAgainstCreatureTypes).to.deep.equal([JINN, MINOTAUR]);
		expect(forkedStick.permittedClassesAndTypes).to.deep.equal([BARD, BARBARIAN, FIGHTER]);
	});

	it('can be instantiated with options', () => {
		const forkedStick = new ForkedStick({
			freedomThresholdModifier: 1, strModifier: 4, dexModifier: 4, doDamageOnImmobilize: true
		});

		expect(forkedStick).to.be.an.instanceof(ForkedStick);
		expect(forkedStick.freedomThresholdModifier).to.equal(1);
		expect(forkedStick.dexModifier).to.equal(4);
		expect(forkedStick.strModifier).to.equal(4);
		expect(forkedStick.doDamageOnImmobilize).to.be.true;
	});

	it('calculates freedom threshold correctly', () => {
		const forkedStick = new ForkedStick();
		const player = new Minotaur({ name: 'player' });

		expect(forkedStick.getFreedomThreshold(player, player)).to.equal(player.ac + forkedStick.freedomThresholdModifier);
	});

	it('can be played against gladiators for a bonus to attack', () => {
		const forkedStick = new ForkedStick();

		const player = new Minotaur({ name: 'player' });
		const target = new Gladiator({ name: 'target' });
		const atkRoll = forkedStick.getAttackRoll(player, target);
		const dmgRoll = forkedStick.getDamageRoll(player, target);

		expect(atkRoll.modifier).to.equal(player.dexModifier + 2);
		expect(dmgRoll.modifier).to.equal(player.strModifier);
	});

	it('can be played against basilisk for a bonus to attack', () => {
		const forkedStick = new ForkedStick();

		const player = new Minotaur({ name: 'player' });
		const target = new Basilisk({ name: 'target' });
		const atkRoll = forkedStick.getAttackRoll(player, target);
		const dmgRoll = forkedStick.getDamageRoll(player, target);

		expect(atkRoll.modifier).to.equal(player.dexModifier + 2);
		expect(dmgRoll.modifier).to.equal(player.strModifier);
	});

	it('can be played against minotaurs for a weakened attack', () => {
		const forkedStick = new ForkedStick();

		const player = new Gladiator({ name: 'player' });
		const target = new Minotaur({ name: 'target' });
		const atkRoll = forkedStick.getAttackRoll(player, target);
		const dmgRoll = forkedStick.getDamageRoll(player, target);

		expect(atkRoll.modifier).to.equal(player.dexModifier - 2);
		expect(dmgRoll.modifier).to.equal(player.strModifier);
	});

	it('can be played against weeping angel with no bonus/penalty', () => {
		const forkedStick = new ForkedStick();

		const target = new WeepingAngel({ name: 'player' });
		const player = new Gladiator({ name: 'target' });
		const dmgRoll = forkedStick.getDamageRoll(player, target);
		const atkRoll = forkedStick.getAttackRoll(player, target);

		expect(dmgRoll.modifier).to.equal(player.strModifier);
		expect(atkRoll.modifier).to.equal(player.dexModifier);
	});

	it('immobilizes basilisk on hit', () => {
		const forkedStick = new ForkedStick();
		const checkSuccessStub = sinon.stub(Object.getPrototypeOf(Object.getPrototypeOf(forkedStick)), 'checkSuccess');

		const player = new Minotaur({ name: 'player' });
		const target = new Basilisk({ name: 'target' });
		const before = target.hp;

		const ring = {
			contestants: [
				{ monster: player },
				{ monster: target }
			],
			channelManager: {
				sendMessages: () => Promise.resolve()
			}
		};

		checkSuccessStub.returns({ success: true, strokeOfLuck: false, curseOfLoki: false });

		return forkedStick
			.play(player, target, ring, ring.contestants)
			.then(() => {
				expect(target.hp).to.equal(before);
				expect(target.encounterEffects[0].effectType).to.equal('ImmobilizeEffect');

				checkSuccessStub.returns({ success: false, strokeOfLuck: false, curseOfLoki: false });

				const hit = new Hit();
				return hit
					.play(target, player, ring, ring.contestants)
					.then(() => {
						checkSuccessStub.restore();

						return expect(target.encounterEffects[0].effectType).to.equal('ImmobilizeEffect');
					});
			});
	});

	it('do damage instead of immobilizing weeping angel on hit', () => {
		const forkedStick = new ForkedStick();
		const checkSuccessStub = sinon.stub(Object.getPrototypeOf(Object.getPrototypeOf(forkedStick)), 'checkSuccess');

		const player = new Minotaur({ name: 'player' });
		const target = new WeepingAngel({ name: 'target' });
		const before = target.hp;

		const ring = {
			contestants: [
				{ monster: player },
				{ monster: target }
			],
			channelManager: {
				sendMessages: () => Promise.resolve()
			}
		};

		checkSuccessStub.returns({ success: true, strokeOfLuck: false, curseOfLoki: false });

		return forkedStick
			.play(player, target, ring, ring.contestants)
			.then(() => {
				checkSuccessStub.restore();

				expect(target.hp).to.be.below(before);
				return expect(target.encounterEffects.length).to.equal(0);
			});
	});

	it('lowers freedomThreshold each turn a target is pinned', () => {
		const forkedStick = new ForkedStick();
		const checkSuccessStub = sinon.stub(Object.getPrototypeOf(Object.getPrototypeOf(Object.getPrototypeOf(forkedStick))), 'checkSuccess');// eslint-disable-line max-len

		const player = new Minotaur({ name: 'player', acVariance: 0 });
		const target = new Basilisk({ name: 'target', acVariance: 0 });

		const ring = {
			contestants: [
				{ monster: player },
				{ monster: target }
			],
			channelManager: {
				sendMessages: () => Promise.resolve()
			}
		};

		checkSuccessStub.returns({ success: true, strokeOfLuck: false, curseOfLoki: false });

		return forkedStick
			.play(player, target, ring, ring.contestants)
			.then(() => {
				expect(target.encounterEffects[0].effectType).to.equal('ImmobilizeEffect');

				checkSuccessStub.returns({ success: false, strokeOfLuck: false, curseOfLoki: false });

				expect(forkedStick.getFreedomThreshold(player, target)).to.equal(6);

				const card = target.encounterEffects.reduce((currentCard, effect) => {
					const modifiedCard = effect({
						activeContestants: [target, player],
						card: currentCard,
						phase: ATTACK_PHASE,
						player,
						ring,
						target
					});

					return modifiedCard || currentCard;
				}, new Hit());

				return card
					.play(target, player, ring, ring.contestants)
					.then(() => {
						expect(forkedStick.getFreedomThreshold(player, target)).to.equal(3);

						checkSuccessStub.restore();

						return expect(target.encounterEffects.length).to.equal(1);
					});
			});
	});

	it('allows immobilized opponents to break free', () => {
		const forkedStick = new ForkedStick();
		const checkSuccessStub = sinon.stub(Object.getPrototypeOf(Object.getPrototypeOf(forkedStick)), 'checkSuccess');

		const forkedStickProto = Object.getPrototypeOf(forkedStick);
		const immobilizeProto = Object.getPrototypeOf(forkedStickProto);
		const hitProto = Object.getPrototypeOf(immobilizeProto);
		const getAttackRollImmoblizeSpy = sinon.spy(immobilizeProto, 'getAttackRoll');
		const getAttackRollHitSpy = sinon.spy(hitProto, 'getAttackRoll');

		const player = new Minotaur({ name: 'player' });
		const target = new Basilisk({ name: 'target' });

		const ring = {
			contestants: [
				{ monster: player },
				{ monster: target }
			],
			channelManager: {
				sendMessages: () => Promise.resolve()
			}
		};

		checkSuccessStub.returns({ success: true, strokeOfLuck: false, curseOfLoki: false });

		return forkedStick
			.play(player, target, ring, ring.contestants)
			.then(() => {
				expect(target.encounterEffects[0].effectType).to.equal('ImmobilizeEffect');
				expect(getAttackRollImmoblizeSpy.callCount).to.equal(1);
				expect(getAttackRollHitSpy.callCount).to.equal(0);

				const card = target.encounterEffects.reduce((currentCard, effect) => {
					const modifiedCard = effect({
						activeContestants: [target, player],
						card: currentCard,
						phase: ATTACK_PHASE,
						player,
						ring,
						target
					});

					return modifiedCard || currentCard;
				}, new Hit());

				return card
					.play(target, player, ring, ring.contestants)
					.then(() => {
						expect(getAttackRollImmoblizeSpy.callCount).to.equal(1);
						expect(getAttackRollHitSpy.callCount).to.equal(2);

						checkSuccessStub.restore();
						getAttackRollImmoblizeSpy.restore();

						return expect(target.encounterEffects.length).to.equal(0);
					});
			});
	});

	it('frees target if player dies between turns', () => {
		const forkedStick = new ForkedStick();
		const checkSuccessStub = sinon.stub(Object.getPrototypeOf(Object.getPrototypeOf(forkedStick)), 'checkSuccess');

		const player = new Minotaur({ name: 'player' });
		const target = new Basilisk({ name: 'target' });

		const ring = {
			contestants: [
				{ monster: player },
				{ monster: target }
			],
			channelManager: {
				sendMessages: () => Promise.resolve()
			}
		};

		checkSuccessStub.returns({ success: true, strokeOfLuck: false, curseOfLoki: false });

		return forkedStick
			.play(player, target, ring, ring.contestants)
			.then(() => {
				expect(target.encounterEffects[0].effectType).to.equal('ImmobilizeEffect');

				checkSuccessStub.returns({ success: false, strokeOfLuck: false, curseOfLoki: false });
				player.dead = true;

				const card = target.encounterEffects.reduce((currentCard, effect) => {
					const modifiedCard = effect({
						activeContestants: [target, player],
						card: currentCard,
						phase: ATTACK_PHASE,
						player,
						ring,
						target
					});

					return modifiedCard || currentCard;
				}, new Hit());

				return card
					.play(target, player, ring, ring.contestants)
					.then(() => {
						checkSuccessStub.restore();

						return expect(target.encounterEffects.length).to.equal(0);
					});
			});
	});
});

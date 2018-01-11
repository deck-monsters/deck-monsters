const { expect, sinon } = require('../shared/test-setup');

const Hit = require('./hit');
const Basilisk = require('../monsters/basilisk');
const Minotaur = require('../monsters/minotaur');
const ForkedMetalRod = require('./forked-metal-rod');
const pause = require('../helpers/pause');
const { roll } = require('../helpers/chance');

const { FIGHTER, BARBARIAN } = require('../helpers/classes');
const { GLADIATOR, MINOTAUR, BASILISK } = require('../helpers/creature-types');

describe('./cards/forked-metal-rod.js', () => {
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
		const forkedMetalRod = new ForkedMetalRod();
		const hit = new Hit();

		const stats = `${hit.stats}

 +2 against Gladiator, Basilisk
 -2 against Minotaur
inneffective against Weeping Angel
Attempt to stab your opponent with strong sharp prongs.

Even if you miss, there's a chance you'll pin them...`;

		const description = 'A dangerously sharp forked metal rod fashioned for Gladiator and Basilisk-hunting.';

		expect(forkedMetalRod).to.be.an.instanceof(ForkedMetalRod);
		expect(forkedMetalRod.description).to.equal(description);
		expect(forkedMetalRod.freedomThresholdModifier).to.equal(3);
		expect(forkedMetalRod.dexModifier).to.equal(3);
		expect(forkedMetalRod.strModifier).to.equal(0);
		expect(forkedMetalRod.hitOnFail).to.be.false;
		expect(forkedMetalRod.doDamageOnImmobilize).to.be.false;
		expect(forkedMetalRod.stats).to.equal(stats);
		expect(forkedMetalRod.strongAgainstCreatureTypes).to.deep.equal([GLADIATOR, BASILISK]);
		expect(forkedMetalRod.weakAgainstCreatureTypes).to.deep.equal([MINOTAUR]);
		expect(forkedMetalRod.permittedClassesAndTypes).to.deep.equal([FIGHTER, BARBARIAN]);
	});

	it('can be instantiated with options', () => {
		const forkedMetalRod = new ForkedMetalRod({
			freedomThresholdModifier: 2, strModifier: 4, dexModifier: 4, hitOnFail: true, doDamageOnImmobilize: true
		});

		expect(forkedMetalRod).to.be.an.instanceof(ForkedMetalRod);
		expect(forkedMetalRod.freedomThresholdModifier).to.equal(2);
		expect(forkedMetalRod.dexModifier).to.equal(4);
		expect(forkedMetalRod.strModifier).to.equal(4);
		expect(forkedMetalRod.hitOnFail).to.be.true;
		expect(forkedMetalRod.doDamageOnImmobilize).to.be.true;
	});

	it('can hit twice and immobilize', () => {
		const forkedMetalRod = new ForkedMetalRod();
		const player = new Minotaur({ name: 'player' });
		const target = new Basilisk({ name: 'target' });
		const before = target.hp;

		const forkedMetalRodProto = Object.getPrototypeOf(forkedMetalRod);
		const hornGoreProto = Object.getPrototypeOf(forkedMetalRodProto);
		const immobilizeProto = Object.getPrototypeOf(hornGoreProto);
		const hitProto = Object.getPrototypeOf(immobilizeProto);
		const baseProto = Object.getPrototypeOf(hitProto);
		const basiliskProto = Object.getPrototypeOf(target);
		const creatureProto = Object.getPrototypeOf(basiliskProto);

		const checkSuccessStub = sinon.stub(baseProto, 'checkSuccess');
		const hitCheckStub = sinon.stub(forkedMetalRodProto, 'hitCheck');
		const hitStub = sinon.spy(creatureProto, 'hit');

		const ring = {
			contestants: [
				{ monster: player },
				{ monster: target }
			],
			channelManager: {
				sendMessages: () => Promise.resolve()
			}
		};

		const attackRoll = roll({ primaryDice: '1d20', modifier: player.dexModifier, bonusDice: player.bonusAttackDice });

		checkSuccessStub.returns({ success: true, strokeOfLuck: false, curseOfLoki: false });
		hitCheckStub.returns({
			attackRoll,
			success: true,
			strokeOfLuck: false,
			curseOfLoki: false
		});

		return forkedMetalRod
			.play(player, target, ring, ring.contestants)
			.then(() => {
				checkSuccessStub.restore();
				hitCheckStub.restore();
				hitStub.restore();

				expect(hitCheckStub.callCount).to.equal(2);
				expect(hitStub.callCount).to.equal(2);
				expect(forkedMetalRod.freedomThresholdModifier).to.equal(7);
				expect(forkedMetalRod.dexModifier).to.equal(7);

				expect(target.hp).to.be.below(before);
				return expect(target.encounterEffects.length).to.equal(1);
			});
	});

	it('can hit once and immobilize', () => {
		const forkedMetalRod = new ForkedMetalRod();
		const player = new Minotaur({ name: 'player' });
		const target = new Basilisk({ name: 'target' });
		const before = target.hp;

		const forkedMetalRodProto = Object.getPrototypeOf(forkedMetalRod);
		const hornGoreProto = Object.getPrototypeOf(forkedMetalRodProto);
		const immobilizeProto = Object.getPrototypeOf(hornGoreProto);
		const hitProto = Object.getPrototypeOf(immobilizeProto);
		const baseProto = Object.getPrototypeOf(hitProto);
		const basiliskProto = Object.getPrototypeOf(target);
		const creatureProto = Object.getPrototypeOf(basiliskProto);

		// checkSuccess must return true in order for hit to be called from hitCheck
		const checkSuccessStub = sinon.stub(baseProto, 'checkSuccess').callsFake(() =>// eslint-disable-line no-unused-vars
			({ success: true, strokeOfLuck: false, curseOfLoki: false }));
		const hitCheckStub = sinon.stub(forkedMetalRodProto, 'hitCheck');
		const goreSpy = sinon.spy(forkedMetalRodProto, 'gore');
		const hitSpy = sinon.spy(creatureProto, 'hit');

		const ring = {
			contestants: [
				{ monster: player },
				{ monster: target }
			],
			channelManager: {
				sendMessages: () => Promise.resolve()
			}
		};

		const attackRoll = roll({ primaryDice: '1d20', modifier: player.dexModifier, bonusDice: player.bonusAttackDice });

		hitCheckStub.onFirstCall().returns({
			attackRoll,
			success: true,
			strokeOfLuck: false,
			curseOfLoki: false
		});
		hitCheckStub.onSecondCall().returns({
			attackRoll,
			success: false,
			strokeOfLuck: false,
			curseOfLoki: false
		});
		hitCheckStub.returns({
			attackRoll,
			success: true,
			strokeOfLuck: false,
			curseOfLoki: false
		});

		return forkedMetalRod
			.play(player, target, ring, ring.contestants)
			.then(() => {
				hitCheckStub.restore();
				checkSuccessStub.restore();
				hitSpy.restore();

				expect(hitCheckStub.callCount).to.equal(2);
				expect(goreSpy.callCount).to.equal(2);
				expect(hitSpy.callCount).to.equal(1);
				expect(forkedMetalRod.freedomThresholdModifier).to.equal(5);
				expect(forkedMetalRod.dexModifier).to.equal(5);
				expect(target.hp).to.be.below(before);
				return expect(target.encounterEffects.length).to.equal(1);
			});
	});

	it('can immobilize even if hit failed', () => {
		const forkedMetalRod = new ForkedMetalRod();
		const player = new Minotaur({ name: 'player' });
		const target = new Basilisk({ name: 'target' });
		const before = target.hp;

		const forkedMetalRodProto = Object.getPrototypeOf(forkedMetalRod);
		const hornGoreProto = Object.getPrototypeOf(forkedMetalRodProto);
		const immobilizeProto = Object.getPrototypeOf(hornGoreProto);
		const hitProto = Object.getPrototypeOf(immobilizeProto);
		const baseProto = Object.getPrototypeOf(hitProto);
		const basiliskProto = Object.getPrototypeOf(target);
		const creatureProto = Object.getPrototypeOf(basiliskProto);

		const checkSuccessStub = sinon.stub(baseProto, 'checkSuccess').callsFake(() =>// eslint-disable-line no-unused-vars
			({ success: true, strokeOfLuck: false, curseOfLoki: false }));
		const hitCheckStub = sinon.stub(forkedMetalRodProto, 'hitCheck');
		const hitStub = sinon.spy(creatureProto, 'hit');

		const ring = {
			contestants: [
				{ monster: player },
				{ monster: target }
			],
			channelManager: {
				sendMessages: () => Promise.resolve()
			}
		};

		const attackRoll = roll({ primaryDice: '1d20', modifier: player.dexModifier, bonusDice: player.bonusAttackDice });

		hitCheckStub.onFirstCall().returns({
			attackRoll,
			success: false,
			strokeOfLuck: false,
			curseOfLoki: false
		});
		hitCheckStub.onSecondCall().returns({
			attackRoll,
			success: false,
			strokeOfLuck: false,
			curseOfLoki: false
		});
		hitCheckStub.returns({
			attackRoll,
			success: true,
			strokeOfLuck: false,
			curseOfLoki: false
		});

		return forkedMetalRod
			.play(player, target, ring, ring.contestants)
			.then(() => {
				checkSuccessStub.restore();
				hitCheckStub.restore();
				hitStub.restore();

				expect(hitCheckStub.callCount).to.equal(2);
				expect(hitStub.callCount).to.equal(0);
				expect(forkedMetalRod.freedomThresholdModifier).to.equal(3);
				expect(forkedMetalRod.dexModifier).to.equal(3);
				expect(target.hp).to.equal(before);
				return expect(target.encounterEffects.length).to.equal(1);
			});
	});

	it('does not immobilize if target is dead', () => {
		const forkedMetalRod = new ForkedMetalRod();
		const player = new Minotaur({ name: 'player' });
		const target = new Basilisk({ name: 'target', hp: 1 });

		const forkedMetalRodProto = Object.getPrototypeOf(forkedMetalRod);
		const hornGoreProto = Object.getPrototypeOf(forkedMetalRodProto);
		const immobilizeProto = Object.getPrototypeOf(hornGoreProto);
		const hitProto = Object.getPrototypeOf(immobilizeProto);
		const baseProto = Object.getPrototypeOf(hitProto);

		const checkSuccessStub = sinon.stub(baseProto, 'checkSuccess');
		const hitCheckStub = sinon.stub(forkedMetalRodProto, 'hitCheck');

		const ring = {
			contestants: [
				{ monster: player },
				{ monster: target }
			],
			channelManager: {
				sendMessages: () => Promise.resolve()
			}
		};

		const attackRoll = { primaryDice: '1d20', result: 19, naturalRoll: { rolled: [19], result: 19 }, bonusResult: 0, modifier: 0 };
		checkSuccessStub.returns({ success: true, strokeOfLuck: false, curseOfLoki: false });
		hitCheckStub.returns({
			attackRoll,
			success: true,
			strokeOfLuck: false,
			curseOfLoki: false
		});

		return forkedMetalRod
			.play(player, target, ring, ring.contestants)
			.then(() => {
				checkSuccessStub.restore();
				hitCheckStub.restore();

				expect(target.hp).to.be.below(0);
				return expect(target.encounterEffects.length).to.equal(0);
			});
	});
});

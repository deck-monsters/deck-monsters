const { expect, sinon } = require('../shared/test-setup');

const Hit = require('./hit');
const Basilisk = require('../monsters/basilisk');
const Minotaur = require('../monsters/minotaur');
const ForkedMetalRod = require('./forked-metal-rod');

const { FIGHTER, BARBARIAN } = require('../helpers/classes');
const { GLADIATOR, MINOTAUR, BASILISK, JINN, WEEPING_ANGEL } = require('../helpers/creature-types');

describe('./cards/forked-metal-rod.js', () => {
	it('can be instantiated with defaults', () => {
		const forkedMetalRod = new ForkedMetalRod();
		const hit = new Hit({ targetProp: forkedMetalRod.targetProp });

		const stats = `Attack twice (once with each prong). +2 to hit and immobilize for each successfull prong hit.

Chance to immobilize: 1d20 vs str.

If already immobilized, hit instead.
${hit.stats}
 +5 advantage vs Gladiator, Basilisk
 +1 advantage vs Jinn, Minotaur
inneffective against Weeping Angel

Opponent breaks free by rolling 1d20 vs immobilizer's str + advantage - (turns immobilized * 3)
Hits immobilizer back on stroke of luck.
Turns immobilized resets on curse of loki.
`;

		const description = 'A dangerously sharp forked metal rod fashioned for Gladiator and Basilisk-hunting.';

		expect(forkedMetalRod).to.be.an.instanceof(ForkedMetalRod);
		expect(forkedMetalRod.description).to.equal(description);
		expect(forkedMetalRod.freedomThresholdModifier).to.equal(3);
		expect(forkedMetalRod.freedomSavingThrowTargetAttr).to.equal('str');
		expect(forkedMetalRod.targetProp).to.equal('ac');
		expect(forkedMetalRod.doDamageOnImmobilize).to.be.false;
		expect(forkedMetalRod.damageDice).to.equal('1d6');
		expect(forkedMetalRod.stats).to.equal(stats);
		expect(forkedMetalRod.strongAgainstCreatureTypes).to.deep.equal([GLADIATOR, BASILISK]);
		expect(forkedMetalRod.weakAgainstCreatureTypes).to.deep.equal([JINN, MINOTAUR]);
		expect(forkedMetalRod.permittedClassesAndTypes).to.deep.equal([FIGHTER, BARBARIAN]);
		expect(forkedMetalRod.uselessAgainstCreatureTypes).to.deep.equal([WEEPING_ANGEL]);
	});

	it('can be instantiated with options', () => {
		const forkedMetalRod = new ForkedMetalRod({
			freedomThresholdModifier: 2, doDamageOnImmobilize: true
		});

		expect(forkedMetalRod).to.be.an.instanceof(ForkedMetalRod);
		expect(forkedMetalRod.freedomThresholdModifier).to.equal(2);
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

		const attackRoll = forkedMetalRod.getAttackRoll(player, target);
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
				expect(forkedMetalRod.new.freedomThresholdModifier).to.equal(7);
				expect(forkedMetalRod.new.dexModifier).to.equal(7);

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

		const attackRoll = forkedMetalRod.getAttackRoll(player, target);

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
				expect(forkedMetalRod.new.freedomThresholdModifier).to.equal(5);
				expect(forkedMetalRod.new.dexModifier).to.equal(5);
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

		const attackRoll = forkedMetalRod.getAttackRoll(player, target);

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
				expect(forkedMetalRod.new.freedomThresholdModifier).to.equal(3);
				expect(forkedMetalRod.new.dexModifier).to.equal(3);
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

		const attackRoll = forkedMetalRod.getAttackRoll(player, target);
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

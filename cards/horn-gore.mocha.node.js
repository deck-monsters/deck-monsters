const { expect, sinon } = require('../shared/test-setup');

const { BASILISK, GLADIATOR, JINN, MINOTAUR, WEEPING_ANGEL } = require('../helpers/creature-types');

const HornGoreCard = require('./horn-gore');

const Basilisk = require('../monsters/basilisk');
const Gladiator = require('../monsters/gladiator');
const Jinn = require('../monsters/jinn');
const Minotaur = require('../monsters/minotaur');
const WeepingAngel = require('../monsters/weeping-angel');

describe('./cards/horn-gore.js', () => {
	let hornGore;
	let angel;
	let basilisk;
	let gladiator;
	let jinn;
	let minotaur;
	let player;

	let hornGoreProto;
	let immobilizeProto;
	let hitProto;
	let baseProto;
	let basiliskProto;
	let creatureProto;

	let checkSuccessStub;
	let hitCheckStub;
	let hitStub;

	let ring;

	let attackRoll;

	before(() => {
		hornGore = new HornGoreCard();
		basilisk = new Basilisk();

		hornGoreProto = Object.getPrototypeOf(hornGore);
		immobilizeProto = Object.getPrototypeOf(hornGoreProto);
		hitProto = Object.getPrototypeOf(immobilizeProto);
		baseProto = Object.getPrototypeOf(hitProto);
		basiliskProto = Object.getPrototypeOf(basilisk);
		creatureProto = Object.getPrototypeOf(basiliskProto);

		checkSuccessStub = sinon.stub(baseProto, 'checkSuccess');
		hitCheckStub = sinon.stub(hornGoreProto, 'hitCheck');
		hitStub = sinon.spy(creatureProto, 'hit');
	});

	beforeEach(() => {
		hornGore = new HornGoreCard();
		angel = new WeepingAngel();
		basilisk = new Basilisk();
		gladiator = new Gladiator();
		jinn = new Jinn();
		minotaur = new Minotaur();
		player = new Minotaur({ dexVariance: 0 });

		ring = {
			contestants: [
				{ monster: player },
				{ monster: angel },
				{ monster: basilisk },
				{ monster: minotaur },
				{ monster: gladiator },
				{ monster: jinn }
			],
			channelManager: {
				sendMessages: () => Promise.resolve()
			}
		};

		attackRoll = hornGore.getAttackRoll(player, basilisk);

		hitCheckStub.returns({
			attackRoll,
			success: true,
			strokeOfLuck: false,
			curseOfLoki: false
		});

		checkSuccessStub.returns({ success: true, strokeOfLuck: false, curseOfLoki: false });
	});

	afterEach(() => {
		checkSuccessStub.reset();
		hitCheckStub.reset();
		hitStub.reset();
	});

	after(() => {
		checkSuccessStub.restore();
		hitCheckStub.restore();
		hitStub.restore();
	});

	it('can be instantiated with defaults', () => {
		expect(hornGore).to.be.an.instanceof(HornGoreCard);
		expect(hornGore.freedomSavingThrowTargetAttr).to.equal('str');
		expect(hornGore.targetProp).to.equal('ac');
		expect(hornGore.freedomThresholdModifier).to.equal(-4);
		expect(hornGore.strongAgainstCreatureTypes).to.deep.equal([MINOTAUR, GLADIATOR]);
		expect(hornGore.weakAgainstCreatureTypes).to.deep.equal([BASILISK, JINN, WEEPING_ANGEL]);
		expect(hornGore.permittedClassesAndTypes).to.deep.equal([MINOTAUR]);
		expect(hornGore.doDamageOnImmobilize).to.be.false;
		expect(hornGore.damageDice).to.equal('1d4');
		expect(hornGore.stats).to.equal(`Attack twice (once with each horn). +2 to hit and immobilize for each successfull horn hit.

If either horn hits, chance to immobilize: 1d20 vs str.

If already immobilized, hit instead.
Hit: 1d20 vs ac / Damage: 1d4
 -2 disadvantage vs Minotaur, Gladiator
 -6 disadvantage vs Basilisk, Jinn, Weeping Angel

Opponent breaks free by rolling 1d20 vs immobilizer's str - disadvantage - (turns immobilized * 3)
Hits immobilizer back on stroke of luck.
Turns immobilized resets on curse of loki.
`);
	});

	it('only uses half of their damage modifier when calculating damage for a horn', () => {
		const damageRoll = hornGore.getDamageRoll(player);

		expect(damageRoll.modifier).to.deep.equal(1);
	});

	it('calculates attackModifier correctly', () => {
		expect(hornGore.getAttackModifier(angel)).to.equal(-6);
		expect(hornGore.getAttackModifier(basilisk)).to.equal(-6);
		expect(hornGore.getAttackModifier(gladiator)).to.equal(-2);
		expect(hornGore.getAttackModifier(jinn)).to.equal(-6);
		expect(hornGore.getAttackModifier(minotaur)).to.equal(-2);
	});

	it('calculates freedom threshold correctly', () => {
		expect(hornGore.getFreedomThreshold(player, angel)).to.equal(1);
		expect(hornGore.getFreedomThreshold(player, basilisk)).to.equal(1);
		expect(hornGore.getFreedomThreshold(player, gladiator)).to.equal(player.str - 2);
		expect(hornGore.getFreedomThreshold(player, jinn)).to.equal(1);
		expect(hornGore.getFreedomThreshold(player, minotaur)).to.equal(player.str - 2);

		angel.encounterModifiers.immobilizedTurns = 1;
		basilisk.encounterModifiers.immobilizedTurns = 1;
		minotaur.encounterModifiers.immobilizedTurns = 1;
		gladiator.encounterModifiers.immobilizedTurns = 1;
		jinn.encounterModifiers.immobilizedTurns = 1;

		expect(hornGore.getFreedomThreshold(player, angel)).to.equal(1);
		expect(hornGore.getFreedomThreshold(player, basilisk)).to.equal(1);
		expect(hornGore.getFreedomThreshold(player, gladiator)).to.equal(player.str - 2 - 3);
		expect(hornGore.getFreedomThreshold(player, jinn)).to.equal(1);
		expect(hornGore.getFreedomThreshold(player, minotaur)).to.equal(player.str - 2 - 3);

		angel.encounterModifiers.immobilizedTurns = 2;
		basilisk.encounterModifiers.immobilizedTurns = 2;
		minotaur.encounterModifiers.immobilizedTurns = 2;
		gladiator.encounterModifiers.immobilizedTurns = 2;
		jinn.encounterModifiers.immobilizedTurns = 2;

		expect(hornGore.getFreedomThreshold(player, angel)).to.equal(1);
		expect(hornGore.getFreedomThreshold(player, basilisk)).to.equal(1);
		expect(hornGore.getFreedomThreshold(player, gladiator)).to.equal(1);
		expect(hornGore.getFreedomThreshold(player, jinn)).to.equal(1);
		expect(hornGore.getFreedomThreshold(player, minotaur)).to.equal(1);
	});

	it('calculates roll modifiers correctly', () => {
		expect(hornGore.getAttackRoll(player, angel).modifier).to.equal(player.dexModifier - 6);
		expect(hornGore.getAttackRoll(player, basilisk).modifier).to.equal(player.dexModifier - 6);
		expect(hornGore.getAttackRoll(player, gladiator).modifier).to.equal(player.dexModifier - 2);
		expect(hornGore.getAttackRoll(player, jinn).modifier).to.equal(player.dexModifier - 6);
		expect(hornGore.getAttackRoll(player, minotaur).modifier).to.equal(player.dexModifier - 2);

		expect(hornGore.getImmobilizeRoll(player, angel).modifier).to.equal(player.strModifier - 6);
		expect(hornGore.getImmobilizeRoll(player, basilisk).modifier).to.equal(player.strModifier - 6);
		expect(hornGore.getImmobilizeRoll(player, gladiator).modifier).to.equal(player.strModifier - 2);
		expect(hornGore.getImmobilizeRoll(player, jinn).modifier).to.equal(player.strModifier - 6);
		expect(hornGore.getImmobilizeRoll(player, minotaur).modifier).to.equal(player.strModifier - 2);

		expect(hornGore.getFreedomRoll(player, angel).modifier).to.equal(angel.strModifier);
		expect(hornGore.getFreedomRoll(player, basilisk).modifier).to.equal(basilisk.strModifier);
		expect(hornGore.getFreedomRoll(player, gladiator).modifier).to.equal(gladiator.strModifier);
		expect(hornGore.getFreedomRoll(player, jinn).modifier).to.equal(jinn.strModifier);
		expect(hornGore.getFreedomRoll(player, minotaur).modifier).to.equal(minotaur.strModifier);
	});

	it('hits twice and immobilizes', () => {
		const before = basilisk.hp;

		return hornGore
			.play(player, basilisk, ring, ring.contestants)
			.then(() => {
				expect(hitCheckStub.callCount).to.equal(2);
				expect(hitStub.callCount).to.equal(2);
				expect(hornGore.freedomThresholdModifier).to.equal(0);
				expect(hornGore.dexModifier).to.equal(4);

				expect(basilisk.hp).to.be.below(before);
				return expect(basilisk.encounterEffects.length).to.equal(1);
			});
	});

	it('tries to immobilize even if only hits once', () => {
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

		const goreSpy = sinon.spy(hornGoreProto, 'gore');
		const before = basilisk.hp;

		return hornGore
			.play(player, basilisk, ring, ring.contestants)
			.then(() => {
				expect(hitCheckStub.callCount).to.equal(2);
				expect(goreSpy.callCount).to.equal(2);
				expect(hitStub.callCount).to.equal(1);
				expect(hornGore.freedomThresholdModifier).to.equal(-2);
				expect(hornGore.dexModifier).to.equal(2);
				expect(basilisk.hp).to.be.below(before);
				return expect(basilisk.encounterEffects.length).to.equal(1);
			});
	});

	it('does not immobilize if basilisk is dead', () => {
		basilisk.hp = 1;

		attackRoll = { primaryDice: '1d20', result: 19, naturalRoll: { rolled: [19], result: 19 }, bonusResult: 0, modifier: 0 };

		return hornGore
			.play(player, basilisk, ring, ring.contestants)
			.then(() => {
				expect(basilisk.hp).to.be.below(0);
				return expect(basilisk.encounterEffects.length).to.equal(0);
			});
	});

	it('does not immobilize on fail to hit', () => {
		const before = basilisk.hp;

		checkSuccessStub.returns({ success: false, strokeOfLuck: false, curseOfLoki: false });
		hitCheckStub.returns({
			attackRoll,
			success: false,
			strokeOfLuck: false,
			curseOfLoki: false
		});

		return hornGore
			.play(player, basilisk, ring, ring.contestants)
			.then(() => {
				expect(hitCheckStub.callCount).to.equal(2);
				expect(hitStub.callCount).to.equal(0);
				expect(hornGore.freedomThresholdModifier).to.equal(-4);
				expect(hornGore.dexModifier).to.equal(0);
				expect(basilisk.hp).to.equal(before);
				return expect(basilisk.encounterEffects.length).to.equal(0);
			});
	});
});

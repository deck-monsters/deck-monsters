const { expect, sinon } = require('../shared/test-setup');
const pause = require('../helpers/pause');

const Hit = require('./hit');
const Entrance = require('./entrance');

const Basilisk = require('../monsters/basilisk');
const Gladiator = require('../monsters/gladiator');
const Jinn = require('../monsters/jinn');
const Minotaur = require('../monsters/minotaur');
const WeepingAngel = require('../monsters/weeping-angel');

const {
	GLADIATOR, JINN, MINOTAUR, BASILISK, WEEPING_ANGEL
} = require('../helpers/creature-types');

describe('./cards/entrance.js', () => {
	let pauseStub;
	let channelStub;

	let angel;
	let basilisk;
	let gladiator;
	let jinn;
	let minotaur;
	let player;

	let ring;

	let entrance;
	let entranceProto;
	let enthrallProto;
	let immobilizeProto;
	let hitProto;
	let baseProto;
	let checkSuccessStub;

	before(() => {
		channelStub = sinon.stub();
		pauseStub = sinon.stub(pause, 'setTimeout');
	});

	beforeEach(() => {
		channelStub.resolves();
		pauseStub.callsArg(0);

		angel = new WeepingAngel();
		basilisk = new Basilisk();
		gladiator = new Gladiator();
		jinn = new Jinn();
		minotaur = new Minotaur();
		player = new WeepingAngel({ intVariance: 0 });

		ring = {
			contestants: [
				{ character: {}, monster: player },
				{ character: {}, monster: angel },
				{ character: {}, monster: basilisk },
				{ character: {}, monster: minotaur },
				{ character: {}, monster: gladiator },
				{ character: {}, monster: jinn }
			],
			channelManager: {
				sendMessages: () => Promise.resolve()
			}
		};

		entrance = new Entrance();
		entranceProto = Object.getPrototypeOf(entrance);
		enthrallProto = Object.getPrototypeOf(entranceProto);
		immobilizeProto = Object.getPrototypeOf(enthrallProto);
		hitProto = Object.getPrototypeOf(immobilizeProto);
		baseProto = Object.getPrototypeOf(hitProto);
		checkSuccessStub = sinon.stub(baseProto, 'checkSuccess');
		checkSuccessStub.returns({ success: true, strokeOfLuck: false, curseOfLoki: false });
	});

	afterEach(() => {
		channelStub.reset();
		pauseStub.reset();
		checkSuccessStub.restore();
	});

	after(() => {
		pause.setTimeout.restore();
	});

	it('can be instantiated with defaults', () => {
		const hit = new Hit({ targetProp: entrance.targetProp });

		const stats = `If already immobilized, hit instead.
${hit.stats}
 +2 advantage vs Basilisk, Gladiator
 -2 disadvantage vs Minotaur, Weeping Angel
inneffective against Jinn

Opponent breaks free by rolling 1d20 vs immobilizer's INT +/- advantage/disadvantage - (turns immobilized * 3)
Hits immobilizer back on stroke of luck.
Turns immobilized resets on curse of loki.

-1 hp each turn immobilized.`;

		expect(entrance).to.be.an.instanceof(Entrance);
		expect(entrance.freedomThresholdModifier).to.equal(2);
		expect(entrance.freedomSavingThrowTargetAttr).to.equal('int');
		expect(entrance.targetProp).to.equal('int');
		expect(entrance.doDamageOnImmobilize).to.be.true;
		expect(entrance.stats).to.equal(stats);
		expect(entrance.strongAgainstCreatureTypes).to.deep.equal([BASILISK, GLADIATOR]);
		expect(entrance.weakAgainstCreatureTypes).to.deep.equal([MINOTAUR, WEEPING_ANGEL]);
		expect(entrance.permittedClassesAndTypes).to.deep.equal([WEEPING_ANGEL]);
		expect(entrance.uselessAgainstCreatureTypes).to.deep.equal([JINN]);
	});

	it('can be instantiated with options', () => {
		const customEntrance = new Entrance({
			freedomThresholdModifier: 4, doDamageOnImmobilize: true
		});

		expect(customEntrance).to.be.an.instanceof(Entrance);
		expect(customEntrance.freedomThresholdModifier).to.equal(4);
		expect(customEntrance.doDamageOnImmobilize).to.be.true;
	});

	it('calculates attackModifier correctly', () => {
		expect(entrance.getAttackModifier(angel)).to.equal(-2);
		expect(entrance.getAttackModifier(basilisk)).to.equal(2);
		expect(entrance.getAttackModifier(gladiator)).to.equal(2);
		expect(entrance.getAttackModifier(jinn)).to.equal(0);
		expect(entrance.getAttackModifier(minotaur)).to.equal(-2);
	});

	it('calculates freedom threshold correctly', () => {
		expect(entrance.getFreedomThreshold(player, angel)).to.equal(5);
		expect(entrance.getFreedomThreshold(player, basilisk)).to.equal(9);
		expect(entrance.getFreedomThreshold(player, gladiator)).to.equal(9);
		expect(entrance.getFreedomThreshold(player, jinn)).to.equal(7);
		expect(entrance.getFreedomThreshold(player, minotaur)).to.equal(5);

		angel.encounterModifiers.immobilizedTurns = 2;
		basilisk.encounterModifiers.immobilizedTurns = 2;
		minotaur.encounterModifiers.immobilizedTurns = 2;
		gladiator.encounterModifiers.immobilizedTurns = 2;
		jinn.encounterModifiers.immobilizedTurns = 2;

		expect(entrance.getFreedomThreshold(player, angel)).to.equal(1);
		expect(entrance.getFreedomThreshold(player, basilisk)).to.equal(3);
		expect(entrance.getFreedomThreshold(player, gladiator)).to.equal(3);
		expect(entrance.getFreedomThreshold(player, jinn)).to.equal(1);
		expect(entrance.getFreedomThreshold(player, minotaur)).to.equal(1);
	});

	it('immobilizes and hits others on play', () => {
		const playerBeforeHP = player.hp;
		const angelBeforeHP = angel.hp;
		const basiliskBeforeHP = basilisk.hp;
		const gladiatorBeforeHP = gladiator.hp;
		const jinnBeforeHP = jinn.hp;
		const minotaurBeforeHP = minotaur.hp;

		return entrance
			.play(player, basilisk, ring, ring.contestants)
			.then(() => {
				expect(player.encounterEffects.length).to.equal(0);
				expect(angel.encounterEffects.length).to.equal(1);
				expect(basilisk.encounterEffects.length).to.equal(1);
				expect(gladiator.encounterEffects.length).to.equal(1);
				expect(jinn.encounterEffects.length).to.equal(0);
				expect(minotaur.encounterEffects.length).to.equal(1);
				expect(player.hp).to.equal(playerBeforeHP);
				expect(angel.hp).to.be.below(angelBeforeHP);
				expect(basilisk.hp).to.be.below(basiliskBeforeHP);
				expect(gladiator.hp).to.be.below(gladiatorBeforeHP);
				expect(jinn.hp).to.be.below(jinnBeforeHP);
				return expect(minotaur.hp).to.be.below(minotaurBeforeHP);
			});
	});
});

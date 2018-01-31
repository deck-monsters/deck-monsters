const { expect, sinon } = require('../shared/test-setup');

const Enthrall = require('./enthrall');
const Hit = require('./hit');

const Basilisk = require('../monsters/basilisk');
const Gladiator = require('../monsters/gladiator');
const Jinn = require('../monsters/jinn');
const Minotaur = require('../monsters/minotaur');
const WeepingAngel = require('../monsters/weeping-angel');

const pause = require('../helpers/pause');


const {
	BASILISK, GLADIATOR, JINN, MINOTAUR, WEEPING_ANGEL
} = require('../helpers/creature-types');

describe('./cards/enthrall.js', () => {
	let pauseStub;
	let channelStub;

	let angel;
	let basilisk;
	let gladiator;
	let jinn;
	let minotaur;
	let player;

	let ring;

	let enthrall;
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

		enthrall = new Enthrall();
		enthrallProto = Object.getPrototypeOf(enthrall);
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
		const hit = new Hit({ targetProp: enthrall.targetProp });

		const stats = `If already immobilized, hit instead.
${hit.stats}
 +2 advantage vs Basilisk, Gladiator
 -2 disadvantage vs Minotaur, Weeping Angel
inneffective against Jinn

Opponent breaks free by rolling 1d20 vs immobilizer's INT +/- advantage/disadvantage - (turns immobilized * 3)
Hits immobilizer back on stroke of luck.
Immobilized turns resets on curse of loki.
`;

		expect(enthrall).to.be.an.instanceof(Enthrall);
		expect(enthrall.freedomThresholdModifier).to.equal(2);
		expect(enthrall.freedomSavingThrowTargetAttr).to.equal('int');
		expect(enthrall.targetProp).to.equal('int');
		expect(enthrall.doDamageOnImmobilize).to.be.false;
		expect(enthrall.stats).to.equal(stats);
		expect(enthrall.strongAgainstCreatureTypes).to.deep.equal([BASILISK, GLADIATOR]);
		expect(enthrall.weakAgainstCreatureTypes).to.deep.equal([MINOTAUR, WEEPING_ANGEL]);
		expect(enthrall.permittedClassesAndTypes).to.deep.equal([WEEPING_ANGEL]);
		expect(enthrall.uselessAgainstCreatureTypes).to.deep.equal([JINN]);
	});

	it('can be instantiated with options', () => {
		const customEnthrall = new Enthrall({
			freedomThresholdModifier: 2, doDamageOnImmobilize: true
		});

		expect(customEnthrall).to.be.an.instanceof(Enthrall);
		expect(customEnthrall.freedomThresholdModifier).to.equal(2);
		expect(customEnthrall.doDamageOnImmobilize).to.be.true;
	});

	it('calculates attackModifier correctly', () => {
		expect(enthrall.getAttackModifier(angel)).to.equal(-2);
		expect(enthrall.getAttackModifier(basilisk)).to.equal(2);
		expect(enthrall.getAttackModifier(gladiator)).to.equal(2);
		expect(enthrall.getAttackModifier(jinn)).to.equal(0);
		expect(enthrall.getAttackModifier(minotaur)).to.equal(-2);
	});

	it('calculates freedom threshold correctly', () => {
		expect(enthrall.getFreedomThreshold(player, angel)).to.equal(5);
		expect(enthrall.getFreedomThreshold(player, basilisk)).to.equal(9);
		expect(enthrall.getFreedomThreshold(player, gladiator)).to.equal(9);
		expect(enthrall.getFreedomThreshold(player, jinn)).to.equal(7);
		expect(enthrall.getFreedomThreshold(player, minotaur)).to.equal(5);

		angel.encounterModifiers.immobilizedTurns = 2;
		basilisk.encounterModifiers.immobilizedTurns = 2;
		minotaur.encounterModifiers.immobilizedTurns = 2;
		gladiator.encounterModifiers.immobilizedTurns = 2;
		jinn.encounterModifiers.immobilizedTurns = 2;

		expect(enthrall.getFreedomThreshold(player, angel)).to.equal(1);
		expect(enthrall.getFreedomThreshold(player, basilisk)).to.equal(3);
		expect(enthrall.getFreedomThreshold(player, gladiator)).to.equal(3);
		expect(enthrall.getFreedomThreshold(player, jinn)).to.equal(1);
		expect(enthrall.getFreedomThreshold(player, minotaur)).to.equal(1);
	});

	it('immobilizes others on play', () => enthrall
		.play(player, basilisk, ring, ring.contestants)
		.then(() => {
			expect(player.encounterEffects.length).to.equal(0);
			expect(angel.encounterEffects.length).to.equal(1);
			expect(basilisk.encounterEffects.length).to.equal(1);
			expect(gladiator.encounterEffects.length).to.equal(1);
			expect(jinn.encounterEffects.length).to.equal(0);
			return expect(minotaur.encounterEffects.length).to.equal(1);
		}));

	it('hits immune players on play', () => {
		const jinnBeforeHP = jinn.hp;

		return enthrall
			.play(player, jinn, ring, ring.contestants)
			.then(() => {
				expect(jinn.hp).to.be.below(jinnBeforeHP);
				return expect(jinn.encounterEffects.length).to.equal(0);
			});
	});
});

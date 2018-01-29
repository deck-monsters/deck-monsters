const { expect, sinon } = require('../shared/test-setup');

const Hit = require('./hit');
const WeepingAngel = require('../monsters/weeping-angel');
const Minotaur = require('../monsters/minotaur');
const Basilisk = require('../monsters/basilisk');
const Gladiator = require('../monsters/gladiator');
const Jinn = require('../monsters/jinn');
const Mesmerize = require('./mesmerize');
const pause = require('../helpers/pause');
const { ATTACK_PHASE } = require('../helpers/phases');

const {
	BASILISK, GLADIATOR, JINN, MINOTAUR, WEEPING_ANGEL
} = require('../helpers/creature-types');

describe('./cards/mesmerize.js', () => {
	let angel;
	let basilisk;
	let channelStub;
	let gladiator;
	let jinn;
	let mesmerize;
	let minotaur;
	let pauseStub;
	let player;
	let ring;

	let mesmerizeProto;
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

		mesmerize = new Mesmerize();
		mesmerizeProto = Object.getPrototypeOf(mesmerize);
		immobilizeProto = Object.getPrototypeOf(mesmerizeProto);
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
		const hit = new Hit();

		const stats = `${hit.stats}


 +2 against Basilisk, Gladiator
 -2 against Jinn, Minotaur, Weeping Angel
Opponent breaks free by rolling 1d20 vs AC - (turns immobilized * 3)
Hits immobilizer back on stroke of luck.
Turns immobilized resets on curse of loki.
`;

		expect(mesmerize).to.be.an.instanceof(Mesmerize);
		expect(mesmerize.freedomThresholdModifier).to.equal(2);
		expect(mesmerize.freedomSavingThrowTargetAttr).to.equal('int');
		expect(mesmerize.doDamageOnImmobilize).to.be.false;
		expect(mesmerize.stats).to.equal(stats);
		expect(mesmerize.strongAgainstCreatureTypes).to.deep.equal([BASILISK, GLADIATOR]);
		expect(mesmerize.weakAgainstCreatureTypes).to.deep.equal([JINN, MINOTAUR, WEEPING_ANGEL]);
		expect(mesmerize.permittedClassesAndTypes).to.deep.equal([WEEPING_ANGEL]);
	});

	it('can be instantiated with options', () => {
		const customMesmerize = new Mesmerize({
			freedomThresholdModifier: 4, doDamageOnImmobilize: true
		});

		expect(customMesmerize).to.be.an.instanceof(Mesmerize);
		expect(customMesmerize.freedomThresholdModifier).to.equal(4);
		expect(customMesmerize.doDamageOnImmobilize).to.be.true;
	});

	it('calculates attackModifier correctly', () => {
		expect(mesmerize.getAttackModifier(angel)).to.equal(-2);
		expect(mesmerize.getAttackModifier(basilisk)).to.equal(2);
		expect(mesmerize.getAttackModifier(gladiator)).to.equal(2);
		expect(mesmerize.getAttackModifier(jinn)).to.equal(-2);
		expect(mesmerize.getAttackModifier(minotaur)).to.equal(-2);
	});

	it('calculates freedom threshold correctly', () => {
		expect(mesmerize.getFreedomThreshold(player, angel)).to.equal(5);
		expect(mesmerize.getFreedomThreshold(player, basilisk)).to.equal(9);
		expect(mesmerize.getFreedomThreshold(player, gladiator)).to.equal(9);
		expect(mesmerize.getFreedomThreshold(player, jinn)).to.equal(5);
		expect(mesmerize.getFreedomThreshold(player, minotaur)).to.equal(5);

		angel.encounterModifiers.immobilizedTurns = 2;
		basilisk.encounterModifiers.immobilizedTurns = 2;
		minotaur.encounterModifiers.immobilizedTurns = 2;
		gladiator.encounterModifiers.immobilizedTurns = 2;
		jinn.encounterModifiers.immobilizedTurns = 2;

		expect(mesmerize.getFreedomThreshold(player, angel)).to.equal(1);
		expect(mesmerize.getFreedomThreshold(player, basilisk)).to.equal(3);
		expect(mesmerize.getFreedomThreshold(player, gladiator)).to.equal(3);
		expect(mesmerize.getFreedomThreshold(player, jinn)).to.equal(1);
		expect(mesmerize.getFreedomThreshold(player, minotaur)).to.equal(1);
	});

	it('immobilizes everyone on play', () => mesmerize
		.play(player, basilisk, ring, ring.contestants)
		.then(() => {
			expect(player.encounterEffects.length).to.equal(1);
			expect(angel.encounterEffects.length).to.equal(1);
			expect(basilisk.encounterEffects.length).to.equal(1);
			expect(gladiator.encounterEffects.length).to.equal(1);
			expect(jinn.encounterEffects.length).to.equal(1);
			return expect(minotaur.encounterEffects.length).to.equal(1);
		}));

	it('hits already immobilized monsters on play', () => {
		const playerBeforeHP = player.hp;
		const angelBeforeHP = angel.hp;
		const basiliskBeforeHP = basilisk.hp;
		const gladiatorBeforeHP = gladiator.hp;
		const jinnBeforeHP = jinn.hp;
		const minotaurBeforeHP = minotaur.hp;

		return mesmerize
			.play(player, basilisk, ring, ring.contestants)
			.then(() => mesmerize
				.play(player, basilisk, ring, ring.contestants)
				.then(() => {
					expect(player.hp).to.be.below(playerBeforeHP);
					expect(angel.hp).to.be.below(angelBeforeHP);
					expect(basilisk.hp).to.be.below(basiliskBeforeHP);
					expect(gladiator.hp).to.be.below(gladiatorBeforeHP);
					expect(jinn.hp).to.be.below(jinnBeforeHP);
					return expect(minotaur.hp).to.be.below(minotaurBeforeHP);
				}));
	});

	it('harms immobilizer on breaking free with natural 20', () => {
		const playerBeforeHP = player.hp;

		return mesmerize
			.play(player, basilisk, ring, ring.contestants)
			.then(() => {
				expect(basilisk.encounterEffects[0].effectType).to.equal('ImmobilizeEffect');

				checkSuccessStub.returns({ success: true, strokeOfLuck: true, curseOfLoki: false });

				const card = basilisk.encounterEffects.reduce((currentCard, effect) => {
					const modifiedCard = effect({
						activeContestants: [basilisk, player],
						card: currentCard,
						phase: ATTACK_PHASE,
						player,
						ring,
						basilisk
					});

					return modifiedCard || currentCard;
				}, new Hit());

				return card
					.play(basilisk, player, ring, ring.contestants)
					.then(() => {
						expect(player.hp).to.be.below(playerBeforeHP);
						return expect(basilisk.encounterEffects.length).to.equal(0);
					});
			});
	});

	it('doesn\'t harm immobilizer on breaking free with natural 20 if immobilizer is self', () => {
		const playerBeforeHP = player.hp;

		return mesmerize
			.play(player, basilisk, ring, ring.contestants)
			.then(() => {
				expect(player.encounterEffects[0].effectType).to.equal('ImmobilizeEffect');

				checkSuccessStub.returns({ success: true, strokeOfLuck: true, curseOfLoki: false });

				const card = player.encounterEffects.reduce((currentCard, effect) => {
					const modifiedCard = effect({
						activeContestants: [basilisk, player],
						card: currentCard,
						phase: ATTACK_PHASE,
						player,
						ring,
						basilisk
					});

					return modifiedCard || currentCard;
				}, new Hit());

				return card
					.play(player, basilisk, ring, ring.contestants)
					.then(() => {
						expect(player.hp).to.equal(playerBeforeHP);
						return expect(player.encounterEffects.length).to.equal(0);
					});
			});
	});
});

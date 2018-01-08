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
Attempt to immobilize your opponent by capturing their neck between strong sharp prongs.

Even if you miss, there's a chance you'll just stab them instead...`;

		expect(forkedMetalRod).to.be.an.instanceof(ForkedMetalRod);
		expect(forkedMetalRod.freedomThresholdModifier).to.equal(3);
		expect(forkedMetalRod.attackModifier).to.equal(3);
		expect(forkedMetalRod.damageModifier).to.equal(0);
		expect(forkedMetalRod.hitOnFail).to.be.true;
		expect(forkedMetalRod.doDamageOnImmobilize).to.be.false;
		expect(forkedMetalRod.stats).to.equal(stats);
		expect(forkedMetalRod.strongAgainstCreatureTypes).to.deep.equal([GLADIATOR, BASILISK]);
		expect(forkedMetalRod.weakAgainstCreatureTypes).to.deep.equal([MINOTAUR]);
		expect(forkedMetalRod.permittedClassesAndTypes).to.deep.equal([FIGHTER, BARBARIAN]);
	});

	it('can be instantiated with options', () => {
		const forkedMetalRod = new ForkedMetalRod({
			freedomThresholdModifier: 2, damageModifier: 4, attackModifier: 4, hitOnFail: false, doDamageOnImmobilize: true
		});

		expect(forkedMetalRod).to.be.an.instanceof(ForkedMetalRod);
		expect(forkedMetalRod.freedomThresholdModifier).to.equal(2);
		expect(forkedMetalRod.attackModifier).to.equal(4);
		expect(forkedMetalRod.damageModifier).to.equal(4);
		expect(forkedMetalRod.hitOnFail).to.be.false;
		expect(forkedMetalRod.doDamageOnImmobilize).to.be.true;
	});

	it('do damage on fail to immobilize', () => {
		const forkedMetalRod = new ForkedMetalRod();
		const checkSuccessStub = sinon.stub(Object.getPrototypeOf(Object.getPrototypeOf(forkedMetalRod)), 'checkSuccess');
		const hitCheckStub = sinon.stub(Object.getPrototypeOf(Object.getPrototypeOf(forkedMetalRod)), 'hitCheck');

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

		const attackRoll = roll({ primaryDice: '1d20', modifier: player.attackModifier, bonusDice: player.bonusAttackDice });

		checkSuccessStub.returns({ success: false, strokeOfLuck: false, curseOfLoki: false });
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

				expect(target.hp).to.be.below(before);
				return expect(target.encounterEffects.length).to.equal(0);
			});
	});
});

const { expect, sinon } = require('../shared/test-setup');

const Hit = require('./hit');
const WeepingAngel = require('../monsters/weeping-angel');
const Minotaur = require('../monsters/minotaur');
const Basilisk = require('../monsters/basilisk');
const Gladiator = require('../monsters/gladiator');
const Enthrall = require('./enthrall');
const pause = require('../helpers/pause');


const {
	GLADIATOR, JINN, MINOTAUR, BASILISK, WEEPING_ANGEL
} = require('../helpers/creature-types');

describe('./cards/enthrall.js', () => {
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
		const enthrall = new Enthrall();
		const hit = new Hit();

		const stats = `${hit.stats}

 +2 against Basilisk, Gladiator
 -2 against Minotaur, Weeping Angel
inneffective against Jinn
Chance to immobilize your opponents with your shocking beauty.`;

		expect(enthrall).to.be.an.instanceof(Enthrall);
		expect(enthrall.freedomThresholdModifier).to.equal(1);
		expect(enthrall.dexModifier).to.equal(2);
		expect(enthrall.strModifier).to.equal(0);
		expect(enthrall.doDamageOnImmobilize).to.be.false;
		expect(enthrall.stats).to.equal(stats);
		expect(enthrall.strongAgainstCreatureTypes).to.deep.equal([BASILISK, GLADIATOR]);
		expect(enthrall.weakAgainstCreatureTypes).to.deep.equal([MINOTAUR, WEEPING_ANGEL]);
		expect(enthrall.permittedClassesAndTypes).to.deep.equal([JINN, WEEPING_ANGEL]);
		expect(enthrall.uselessAgainstCreatureTypes).to.deep.equal([JINN]);
	});

	it('can be instantiated with options', () => {
		const enthrall = new Enthrall({
			freedomThresholdModifier: 2, strModifier: 4, dexModifier: 4, doDamageOnImmobilize: true
		});

		expect(enthrall).to.be.an.instanceof(Enthrall);
		expect(enthrall.freedomThresholdModifier).to.equal(2);
		expect(enthrall.dexModifier).to.equal(4);
		expect(enthrall.strModifier).to.equal(4);
		expect(enthrall.doDamageOnImmobilize).to.be.true;
	});

	it('calculates freedom threshold correctly', () => {
		const enthrall = new Enthrall();
		const player = new WeepingAngel({ name: 'player' });
		const target = new WeepingAngel({ name: 'target' });

		expect(enthrall.getFreedomThreshold(player, target)).to.equal(10 + enthrall.freedomThresholdModifier);

		target.encounterModifiers.immobilizedTurns = 2;

		expect(enthrall.getFreedomThreshold(player, target)).to.equal(4 + enthrall.freedomThresholdModifier);
	});

	it('immobilizes others on success', () => {
		const enthrall = new Enthrall();
		const checkSuccessStub = sinon.stub(Object.getPrototypeOf(Object.getPrototypeOf(enthrall)), 'checkSuccess');

		const player = new WeepingAngel({ name: 'player' });
		const target1 = new Basilisk({ name: 'target1' });
		const target2 = new Minotaur({ name: 'target2' });
		const target3 = new Gladiator({ name: 'target3' });
		const ring = {
			contestants: [
				{ monster: player },
				{ monster: target1 },
				{ monster: target2 },
				{ monster: target3 }
			],
			channelManager: {
				sendMessages: () => Promise.resolve()
			}
		};

		checkSuccessStub.returns({ success: true, strokeOfLuck: false, curseOfLoki: false });

		return enthrall
			.play(player, target1, ring, ring.contestants)
			.then(() => {
				checkSuccessStub.restore();

				expect(player.encounterEffects.length).to.equal(0);
				expect(target1.encounterEffects.length).to.equal(1);
				expect(target2.encounterEffects.length).to.equal(1);
				return expect(target3.encounterEffects.length).to.equal(1);
			});
	});
});

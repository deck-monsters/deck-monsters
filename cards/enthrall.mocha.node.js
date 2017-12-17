const { expect, sinon } = require('../shared/test-setup');

const Hit = require('./hit');
const WeepingAngel = require('../monsters/weeping-angel');
const Minotaur = require('../monsters/minotaur');
const Enthrall = require('./enthrall');
const pause = require('../helpers/pause');
const { roll } = require('../helpers/chance');


const { GLADIATOR, MINOTAUR, BASILISK, WEEPING_ANGEL } = require('../helpers/creature-types');

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
Chance to immobilize your opponents with your shocking beauty.`;

		expect(enthrall).to.be.an.instanceof(Enthrall);
		expect(enthrall.freedomThresholdModifier).to.equal(1);
		expect(enthrall.attackModifier).to.equal(2);
		expect(enthrall.damageModifier).to.equal(0);
		expect(enthrall.hitOnFail).to.be.false;
		expect(enthrall.doDamageOnImmobilize).to.be.false;
		expect(enthrall.stats).to.equal(stats);
		expect(enthrall.strongAgainstCreatureTypes).to.deep.equal([GLADIATOR, BASILISK]);
		expect(enthrall.weakAgainstCreatureTypes).to.deep.equal([MINOTAUR, WEEPING_ANGEL]);
		expect(enthrall.permittedClassesAndTypes).to.deep.equal([WEEPING_ANGEL]);
	});

	it('can be instantiated with options', () => {
		const enthrall = new Enthrall({
			freedomThresholdModifier: 2, damageModifier: 4, attackModifier: 4, hitOnFail: true, doDamageOnImmobilize: true
		});

		expect(enthrall).to.be.an.instanceof(Enthrall);
		expect(enthrall.freedomThresholdModifier).to.equal(2);
		expect(enthrall.attackModifier).to.equal(4);
		expect(enthrall.damageModifier).to.equal(4);
		expect(enthrall.hitOnFail).to.be.true;
		expect(enthrall.doDamageOnImmobilize).to.be.true;
	});

	it('calculates freedom threshold correctly', () => {
		const enthrall = new Enthrall();
		const player = new WeepingAngel({ name: 'player' });

		expect(enthrall.getFreedomThreshold(player)).to.equal(10 + enthrall.freedomThresholdModifier);
	});
});

const { expect, sinon } = require('../shared/test-setup');

const Hit = require('./hit');
const WeepingAngel = require('../monsters/weeping-angel');
const Minotaur = require('../monsters/minotaur');
const Mesmerize = require('./mesmerize');
const pause = require('../helpers/pause');
const { roll } = require('../helpers/chance');


const { GLADIATOR, MINOTAUR, BASILISK, WEEPING_ANGEL } = require('../helpers/creature-types');

describe('./cards/mesmerize.js', () => {
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
		const mesmerize = new Mesmerize();
		const hit = new Hit();

		const stats = `${hit.stats}
Chance to immobilize everyone with your shocking beauty.`;

		expect(mesmerize).to.be.an.instanceof(Mesmerize);
		expect(mesmerize.freedomThresholdModifier).to.equal(0);
		expect(mesmerize.attackModifier).to.equal(2);
		expect(mesmerize.damageModifier).to.equal(0);
		expect(mesmerize.hitOnFail).to.be.false;
		expect(mesmerize.doDamageOnImmobilize).to.be.false;
		expect(mesmerize.stats).to.equal(stats);
		expect(mesmerize.strongAgainstCreatureTypes).to.deep.equal([GLADIATOR, BASILISK]);
		expect(mesmerize.weakAgainstCreatureTypes).to.deep.equal([MINOTAUR, WEEPING_ANGEL]);
		expect(mesmerize.permittedClassesAndTypes).to.deep.equal([WEEPING_ANGEL]);
	});

	it('can be instantiated with options', () => {
		const mesmerize = new Mesmerize({
			freedomThresholdModifier: 2, damageModifier: 4, attackModifier: 4, hitOnFail: true, doDamageOnImmobilize: true
		});

		expect(mesmerize).to.be.an.instanceof(Mesmerize);
		expect(mesmerize.freedomThresholdModifier).to.equal(2);
		expect(mesmerize.attackModifier).to.equal(4);
		expect(mesmerize.damageModifier).to.equal(4);
		expect(mesmerize.hitOnFail).to.be.true;
		expect(mesmerize.doDamageOnImmobilize).to.be.true;
	});

	it('calculates freedom threshold correctly', () => {
		const mesmerize = new Mesmerize();
		const player = new WeepingAngel({ name: 'player' });

		expect(mesmerize.getFreedomThreshold(player)).to.equal(10 + mesmerize.freedomThresholdModifier);
	});
});

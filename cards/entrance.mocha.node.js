const { expect, sinon } = require('../shared/test-setup');

const Hit = require('./hit');
const WeepingAngel = require('../monsters/weeping-angel');
const Minotaur = require('../monsters/minotaur');
const Entrance = require('./entrance');
const pause = require('../helpers/pause');
const { roll } = require('../helpers/chance');


const { GLADIATOR, MINOTAUR, BASILISK, WEEPING_ANGEL } = require('../helpers/creature-types');

describe('./cards/entrance.js', () => {
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
		const entrance = new Entrance();
		const hit = new Hit();

		const stats = `${hit.stats}
Chance to immobilize and damage your opponents with your painfully shocking beauty.`;

		expect(entrance).to.be.an.instanceof(Entrance);
		expect(entrance.freedomThresholdModifier).to.equal(2);
		expect(entrance.attackModifier).to.equal(2);
		expect(entrance.damageModifier).to.equal(0);
		expect(entrance.hitOnFail).to.be.true;
		expect(entrance.doDamageOnImmobilize).to.be.true;
		expect(entrance.stats).to.equal(stats);
		expect(entrance.strongAgainstCreatureTypes).to.deep.equal([GLADIATOR, BASILISK]);
		expect(entrance.weakAgainstCreatureTypes).to.deep.equal([MINOTAUR, WEEPING_ANGEL]);
		expect(entrance.permittedClassesAndTypes).to.deep.equal([WEEPING_ANGEL]);
	});

	it('can be instantiated with options', () => {
		const entrance = new Entrance({
			freedomThresholdModifier: 4, damageModifier: 4, attackModifier: 4, hitOnFail: true, doDamageOnImmobilize: true
		});

		expect(entrance).to.be.an.instanceof(Entrance);
		expect(entrance.freedomThresholdModifier).to.equal(4);
		expect(entrance.attackModifier).to.equal(4);
		expect(entrance.damageModifier).to.equal(4);
		expect(entrance.hitOnFail).to.be.true;
		expect(entrance.doDamageOnImmobilize).to.be.true;
	});

	it('calculates freedom threshold correctly', () => {
		const entrance = new Entrance();
		const player = new WeepingAngel({ name: 'player' });

		expect(entrance.getFreedomThreshold(player)).to.equal(10 + entrance.freedomThresholdModifier);
	});
});

const { expect, sinon } = require('../shared/test-setup');

const WeepingAngel = require('./weeping-angel');
const { WEEPING_ANGEL } = require('../helpers/creature-types');
const pause = require('../helpers/pause');

describe('./monsters/weeping-angel.js', () => {
	let pauseStub;

	before(() => {
		pauseStub = sinon.stub(pause, 'setTimeout');
	});

	beforeEach(() => {
		pauseStub.callsArg(0);
	});

	afterEach(() => {
		pauseStub.reset();
	});

	after(() => {
		pause.setTimeout.restore();
	});

	it('can be instantiated with defaults', () => {
		const weepingAngel = new WeepingAngel();

		expect(weepingAngel).to.be.an.instanceof(WeepingAngel);
		expect(weepingAngel.name).to.equal("WeepingAngel");
		expect(weepingAngel.creatureType).to.equal(WEEPING_ANGEL);
		expect(weepingAngel.givenName).to.be.a('string');
		expect(weepingAngel.options).to.deep.contain({
			attackModifier: 3,
			damageModifier: -1,
			color: 'stone gray',
			icon: '🌟'
		});
	});

	it('can be instantiated with higher XP', () => {
		const weepingAngel = new WeepingAngel({ xp: 1000 });

		expect(weepingAngel).to.be.an.instanceof(WeepingAngel);
		expect(weepingAngel.name).to.equal("WeepingAngel");
		expect(weepingAngel.creatureType).to.equal(WEEPING_ANGEL);
		expect(weepingAngel.givenName).to.be.a('string');
		expect(weepingAngel.options).to.deep.contain({
			attackModifier: 3,
			damageModifier: -1,
			color: 'stone gray',
			icon: '🌟',
			xp: 1000
		});
	});

	it('can tell if it is bloodied', () => {
		const weepingAngel = new WeepingAngel();

		expect(weepingAngel.bloodied).to.equal(false);

		weepingAngel.hp = weepingAngel.bloodiedValue + 1;

		expect(weepingAngel.bloodied).to.equal(false);

		weepingAngel.hp = weepingAngel.bloodiedValue;

		expect(weepingAngel.bloodied).to.equal(true);

		weepingAngel.hp = 1;

		expect(weepingAngel.bloodied).to.equal(true);
	});

	it('can tell if it is destroyed', () => {
		const weepingAngel = new WeepingAngel();

		expect(weepingAngel.destroyed).to.equal(false);

		weepingAngel.hp = -weepingAngel.bloodiedValue - 1;

		expect(weepingAngel.destroyed).to.equal(true);
	});
});

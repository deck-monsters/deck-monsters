const { expect, sinon } = require('../shared/test-setup');

const Basilisk = require('./basilisk');
const pause = require('../helpers/pause');

describe('./monsters/basilisk.js', () => {
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
		const basilisk = new Basilisk();

		expect(basilisk).to.be.an.instanceof(Basilisk);
		expect(basilisk.name).to.equal('Basilisk');
		expect(basilisk.givenName).to.be.a('string');
		expect(basilisk.options).to.deep.contain({
			attackModifier: -1,
			damageModifier: 3,
			color: 'tan',
			icon: '🐍'
		});
	});

	it('can be instantiated with higher XP', () => {
		const basilisk = new Basilisk({ xp: 1000 });

		expect(basilisk).to.be.an.instanceof(Basilisk);
		expect(basilisk.name).to.equal('Basilisk');
		expect(basilisk.givenName).to.be.a('string');
		expect(basilisk.options).to.deep.contain({
			attackModifier: -1,
			damageModifier: 3,
			color: 'tan',
			icon: '🐍',
			xp: 1000
		});
	});

	it('can tell if it is bloodied', () => {
		const basilisk = new Basilisk();

		expect(basilisk.bloodied).to.equal(false);

		basilisk.hp = basilisk.bloodiedValue + 1;

		expect(basilisk.bloodied).to.equal(false);

		basilisk.hp = basilisk.bloodiedValue;

		expect(basilisk.bloodied).to.equal(true);

		basilisk.hp = 1;

		expect(basilisk.bloodied).to.equal(true);
	});

	it('can tell if it is destroyed', () => {
		const basilisk = new Basilisk();

		expect(basilisk.destroyed).to.equal(false);

		basilisk.hp = -basilisk.bloodiedValue - 1;

		expect(basilisk.destroyed).to.equal(true);
	});
});

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
});

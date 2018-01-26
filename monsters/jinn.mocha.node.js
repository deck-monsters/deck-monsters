const { expect, sinon } = require('../shared/test-setup');

const Jinn = require('./jinn');
const { JINN } = require('../helpers/creature-types');
const pause = require('../helpers/pause');

describe('./monsters/jinn.js', () => {
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
		const jinn = new Jinn();

		expect(jinn).to.be.an.instanceof(Jinn);
		expect(jinn.name).to.equal('Jinn');
		expect(jinn.creatureType).to.equal(JINN);
		expect(jinn.givenName).to.be.a('string');
		expect(jinn.options).to.deep.contain({
			dexModifier: 1,
			strModifier: 0,
			intModifier: 1,
			color: 'fiery red',
			icon: '🕌'
		});
	});
});

const { expect, sinon } = require('../shared/test-setup');

const BasicShieldCard = require('./basic-shield');
const Gladiator = require('../monsters/gladiator');
const pause = require('../helpers/pause');

describe('./cards/basic-shield.js', () => {
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
		const basicShield = new BasicShieldCard();

		expect(basicShield).to.be.an.instanceof(BasicShieldCard);
		expect(basicShield.icon).to.equal('🛡');
		expect(basicShield.boostAmount).to.equal(2);
		expect(basicShield.boostedProp).to.equal('ac');
		expect(basicShield.stats).to.equal('Boost: ac +2');
	});

	it('increases ac', () => {
		const basicShield = new BasicShieldCard();

		const player = new Gladiator({ name: 'player' });
		const before = player.ac;

		return basicShield.play(player)
			.then((result) => {
				expect(result).to.equal(true);
				return expect(player.ac).to.be.above(before);
			});
	});
});

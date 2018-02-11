const { expect, sinon } = require('../shared/test-setup');

const BasicShieldCard = require('./basic-shield');
const Gladiator = require('../monsters/gladiator');
const pause = require('../helpers/pause');

describe('./cards/basic-shield.js', () => {
	let pauseStub;

	before(() => {
		pauseStub = sinon.stub(pause, 'getThrottleRate');
		pauseStub.returns(5);
	});

	after(() => {
		pause.getThrottleRate.restore();
	});

	it('can be instantiated with defaults', () => {
		const basicShield = new BasicShieldCard();

		expect(basicShield).to.be.an.instanceof(BasicShieldCard);
		expect(basicShield.icon).to.equal('🛡');
		expect(basicShield.boostAmount).to.equal(2);
		expect(basicShield.boostedProp).to.equal('ac');
		expect(basicShield.stats).to.equal('Boost: ac +2 (max boost of level * 2, or 1 for beginner, then boost granted to hp instead).\nIf hit by melee attack, damage comes out of ac boost first.'); // eslint-disable-line max-len
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

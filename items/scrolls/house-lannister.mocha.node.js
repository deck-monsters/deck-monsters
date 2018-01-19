/* eslint-disable max-len */
const { expect, sinon } = require('../../shared/test-setup');

const pause = require('../../helpers/pause');
const HouseLannisterScroll = require('./house-lannister');
const Jinn = require('../../monsters/jinn');

describe('./items/scrolls/house-lannister.js', () => {
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
		const houseLannister = new HouseLannisterScroll();
		const jenn = new Jinn({ name: 'jenn', acVariance: 0, xp: 1300, gender: 'female' });

		expect(houseLannister).to.be.an.instanceof(HouseLannisterScroll);
		expect(houseLannister.numberOfUses).to.equal(3);
		expect(houseLannister.expired).to.be.false;
		expect(houseLannister.stats).to.equal('Usable 3 times.');
		expect(houseLannister.icon).to.equal('🦁');
		expect(houseLannister.getTargetingDetails(jenn)).to.equal('Jenn will target the opponent who attacked her last, unless directed otherwise by a specific card.');
	});
});

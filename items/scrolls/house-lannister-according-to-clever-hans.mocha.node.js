/* eslint-disable max-len */
const { expect, sinon } = require('../../shared/test-setup');

const pause = require('../../helpers/pause');
const HouseLannisterScroll = require('./house-lannister-according-to-clever-hans');
const Jinn = require('../../monsters/jinn');

const { TARGET_PLAYER_WHO_HIT_YOU_LAST_ACCORDING_TO_HANS } = require('../../helpers/targeting-strategies');
const { ALMOST_NOTHING } = require('../../helpers/costs');
const { ABUNDANT } = require('../../helpers/probabilities');

describe('./items/scrolls/house-lannister-according-to-clever-hans.js', () => {
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

		expect(houseLannister.probability).to.equal(ABUNDANT.probability);
		expect(houseLannister.cost).to.equal(ALMOST_NOTHING);
		expect(houseLannister).to.be.an.instanceof(HouseLannisterScroll);
		expect(houseLannister.numberOfUses).to.equal(3);
		expect(houseLannister.expired).to.be.false;
		expect(houseLannister.stats).to.equal('Usable 3 times.');
		expect(houseLannister.icon).to.equal('👦');
		expect(houseLannister.targetingStrategy).to.equal(TARGET_PLAYER_WHO_HIT_YOU_LAST_ACCORDING_TO_HANS);
		expect(houseLannister.itemType).to.equal('House Lannister According To Clever Hans');
		expect(houseLannister.getTargetingDetails(jenn)).to.equal('Jenn will target the opponent who attacked her last, unless directed otherwise by a specific card.');
		expect(houseLannister.description).to.equal(`A Lannister always pays his debts...

Target the opponent who attacked you last, unless directed otherwise by a specific card.`);
	});
});

/* eslint-disable max-len */
const { expect, sinon } = require('../../shared/test-setup');

const pause = require('../../helpers/pause');
const SirRobinScroll = require('./sir-robin-according-to-clever-hans');
const Jinn = require('../../monsters/jinn');

const { TARGET_HIGHEST_HP_PLAYER_ACCORDING_TO_HANS } = require('../../helpers/targeting-strategies');
const { ALMOST_NOTHING } = require('../../helpers/costs');
const { ABUNDANT } = require('../../helpers/probabilities');

describe('./items/scrolls/sir-robin-according-to-clever-hans.js', () => {
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
		const sirRobin = new SirRobinScroll();
		const jenn = new Jinn({ name: 'jenn', acVariance: 0, xp: 1300, gender: 'female' });

		expect(sirRobin.probability).to.equal(ABUNDANT.probability);
		expect(sirRobin.cost).to.equal(ALMOST_NOTHING);
		expect(sirRobin).to.be.an.instanceof(SirRobinScroll);
		expect(sirRobin.numberOfUses).to.equal(3);
		expect(sirRobin.expired).to.be.false;
		expect(sirRobin.stats).to.equal('Usable 3 times.');
		expect(sirRobin.icon).to.equal('👦');
		expect(sirRobin.itemType).to.equal('The Tale of Sir Robin According to Clever Hans');
		expect(sirRobin.targetingStrategy).to.equal(TARGET_HIGHEST_HP_PLAYER_ACCORDING_TO_HANS);
		expect(sirRobin.getTargetingDetails(jenn)).to.equal('whenever Jenn is in the ring she will bravely look about, choose the player with the highest current hp, and target them, unless directed otherwise by a specific card.');
		expect(sirRobin.description).to.equal(`He was not in the least bit scared to be mashed into a pulp, or to have his eyes gouged out, and his elbows broken, to have his kneecaps split, and his body burned away... brave Sir Robin!

Target whichever player currently has the highest hp.`);
	});
});

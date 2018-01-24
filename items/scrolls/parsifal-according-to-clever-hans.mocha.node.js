/* eslint-disable max-len */
const { expect, sinon } = require('../../shared/test-setup');

const pause = require('../../helpers/pause');
const ParsifalScroll = require('./parsifal-according-to-clever-hans');
const Jinn = require('../../monsters/jinn');

const { TARGET_PREVIOUS_PLAYER } = require('../../helpers/targeting-strategies');

describe('./items/scrolls/parsifal-according-to-clever-hans.js', () => {
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
		const parsifal = new ParsifalScroll();
		const jenn = new Jinn({ name: 'jenn', acVariance: 0, xp: 1300, gender: 'female' });

		expect(parsifal).to.be.an.instanceof(ParsifalScroll);
		expect(parsifal.numberOfUses).to.equal(3);
		expect(parsifal.expired).to.be.false;
		expect(parsifal.stats).to.equal('Usable 3 times.');
		expect(parsifal.icon).to.equal('🐎');
		expect(parsifal.targetingStrategy).to.equal(TARGET_PREVIOUS_PLAYER);
		expect(parsifal.getTargetingDetails(jenn)).to.equal("Clever Jenn's mother told her that she should keep her friends closed and her enemies should be the closers, and she should always stack the openers up next to her so she never needs a chair unless directed otherwise by a specific card. Or... Something...");
		expect(parsifal.description).to.equal(`Your mother said that my mother said that if you know your enemy and know yourself, you will not be put at risk even in a hundred battles. If you only know yourself, but not your opponent, you may win or may lose. If you know neither yourself nor your enemy, you will always endanger yourself.

Your mother told you to keep your strategy simple: your opponent is always the person to your right (wait, no, your other right --No no, the other other... You know what? Just forget it... That one's fine).`);
	});
});

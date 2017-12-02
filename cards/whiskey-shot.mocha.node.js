const { expect, sinon } = require('../shared/test-setup');

const WhiskeyShotCard = require('./whiskey-shot');
const Basilisk = require('../monsters/basilisk');
const pause = require('../helpers/pause');

describe('./cards/whiskey-shot.js', () => {
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
		const whiskeyShot = new WhiskeyShotCard();

		expect(whiskeyShot).to.be.an.instanceof(WhiskeyShotCard);
		expect(whiskeyShot.healthDice).to.equal('1d8');
		expect(whiskeyShot.probability).to.equal(40);
		expect(whiskeyShot.stats).to.equal('Health: 1d8 / Possible Stroke of Luck');
	});

	it('heals the player', () => {
		const whiskeyShot = new WhiskeyShotCard();

		const player = new Basilisk({ name: 'player', hp: 2 });
		const before = player.hp;

		return whiskeyShot.play(player)
			.then((result) => {
				expect(result).to.equal(true);
				return expect(player.hp).to.be.above(before);
			});
	});
});

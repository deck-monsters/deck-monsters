const { expect, sinon } = require('../shared/test-setup');

const ScotchCard = require('./scotch');
const Basilisk = require('../monsters/basilisk');
const pause = require('../helpers/pause');

describe('./cards/scotch.js', () => {
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
		const scotch = new ScotchCard();

		expect(scotch.probability).to.equal(10);
		expect(scotch.stats).to.equal('Health: 2d6\nPossiblity of Stroke of Luck');
	});

	it('heals the player', () => {
		const scotch = new ScotchCard();

		const player = new Basilisk({ name: 'player', hp: 2 });
		const before = player.hp;

		return scotch.play(player)
			.then((result) => {
				expect(result).to.equal(true);
				return expect(player.hp).to.be.above(before);
			});
	});
});

const { expect, sinon } = require('../shared/test-setup');

const RandomCard = require('./random');
const TestCard = require('./test');
const Basilisk = require('../monsters/basilisk');
const cards = require('./index');
const pause = require('../helpers/pause');

describe('./cards/random.js', () => {
	let channelStub;
	let drawStub;
	let pauseStub;

	before(() => {
		channelStub = sinon.stub();
		drawStub = sinon.stub(cards, 'draw');
		pauseStub = sinon.stub(pause, 'setTimeout');
	});

	beforeEach(() => {
		channelStub.resolves();
		drawStub.returns(new TestCard());
		pauseStub.callsArg(0);
	});

	afterEach(() => {
		channelStub.reset();
		drawStub.reset();
		pauseStub.reset();
	});

	after(() => {
		cards.draw.restore();
		pause.setTimeout.restore();
	});

	it('can be instantiated with defaults', () => {
		const random = new RandomCard();

		expect(random).to.be.an.instanceof(RandomCard);
	});

	it('draws and plays another card', () => {
		const random = new RandomCard();

		const player = new Basilisk({ name: 'player' });
		const target = new Basilisk({ name: 'target' });

		return random
			.play(player, target)
			.then(() => {
				expect(drawStub).to.have.been.calledWith(random.options, player);
				expect(player.played).to.equal(1);
				expect(target.targeted).to.equal(1);
			});
	});
});

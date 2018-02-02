const { expect, sinon } = require('../shared/test-setup');

const RandomCard = require('./random');
const TestCard = require('./test');
const Basilisk = require('../monsters/basilisk');
const cards = require('./index');

describe('./cards/random.js', () => {
	let drawStub;

	before(() => {
		drawStub = sinon.stub(cards, 'draw');
	});

	beforeEach(() => {
		drawStub.returns(new TestCard());
	});

	afterEach(() => {
		drawStub.reset();
	});

	after(() => {
		cards.draw.restore();
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

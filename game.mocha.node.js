const { expect, sinon } = require('./shared/test-setup');

const Game = require('./game');

const BaseCard = require('./cards/base');
const ChannelManager = require('./channel');
const Ring = require('./ring');

describe('./game.js', () => {
	let publicChannelStub;

	before(() => {
		publicChannelStub = sinon.stub();
	});

	beforeEach(() => {
		publicChannelStub.resolves();
	});

	afterEach(() => {
		publicChannelStub.reset();
	});

	it('has a channel manager', () => {
		const game = new Game(publicChannelStub);

		expect(game.channelManager).to.be.an.instanceof(ChannelManager);
	});

	it('has a public channel', () => {
		const game = new Game(publicChannelStub);
		const queueMessageStub = sinon.stub(game.channelManager, 'queueMessage');

		expect(game.channelManager.getChannel({ channelName: 'PUBLIC_CHANNEL' })).to.equal(publicChannelStub);

		game.publicChannel({ announce: 'Hello World' });

		expect(queueMessageStub).to.have.been.calledWith({ announce: 'Hello World', channelName: 'PUBLIC_CHANNEL' });
	});

	it('has a ring', () => {
		const game = new Game(publicChannelStub);

		expect(game.ring).to.be.an.instanceof(Ring);
		expect(game.ring.channelManager).to.equal(game.channelManager);
		expect(game.getRing()).to.equal(game.ring);
	});

	it('can look at the ring', () => {
		const game = new Game(publicChannelStub);
		const lookStub = sinon.stub(game.ring, 'look');

		game.lookAtRing('channel');

		expect(lookStub).to.have.been.calledOnce;
		expect(lookStub).to.have.been.calledWith('channel');
	});

	it('can save state', (done) => {
		const game = new Game(publicChannelStub);
		const saveStateStub = sinon.stub();

		game.saveState = saveStateStub;
		game.emit('stateChange');

		setImmediate(() => {
			expect(saveStateStub).to.have.been.calledOnce;
			expect(saveStateStub).to.have.been.calledWith('{"name":"Game","options":{}}');
			done();
		});
	});

	it('can draw a card', () => {
		const game = new Game(publicChannelStub);
		const card = game.drawCard({ useless: 'option' });

		expect(card).to.be.an.instanceof(BaseCard);
		expect(card.name).to.not.equal(BaseCard.name);
		expect(card.options.useless).to.be.undefined;
	});

	it('can draw a card for a specific monster', () => {
		const game = new Game(publicChannelStub);
		const canHoldCard = sinon.stub().returns(true);
		const monster = { canHoldCard };
		const card = game.drawCard({ useless: 'option' }, monster);

		expect(card).to.be.an.instanceof(BaseCard);
		expect(canHoldCard).to.have.been.called;
	});
});

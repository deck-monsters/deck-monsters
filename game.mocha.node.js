const { expect, sinon } = require('./shared/test-setup');

const Game = require('./game');

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
	});

	it('can save state', () => {
		const game = new Game(publicChannelStub);
		const saveStateStub = sinon.stub();

		game.saveState = saveStateStub;
		game.emit('stateChange');

		expect(saveStateStub).to.have.been.calledOnce;
		expect(saveStateStub).to.have.been.calledWith('{"name":"Game","options":{}}');
	});
});

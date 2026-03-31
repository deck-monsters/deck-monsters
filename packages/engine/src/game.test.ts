import { expect } from 'chai';
import sinon from 'sinon';
import zlib from 'node:zlib';

import Game from './game.js';
import { BaseCard } from './cards/base.js';
import ChannelManager from './channel/index.js';
import Ring from './ring/index.js';

describe('game.ts', () => {
	let publicChannelStub: sinon.SinonStub;

	beforeEach(() => {
		publicChannelStub = sinon.stub().resolves(undefined);
	});

	afterEach(() => {
		sinon.restore();
	});

	it('has a channel manager', () => {
		const game = new Game(publicChannelStub);

		expect(game.channelManager).to.be.instanceOf(ChannelManager);
	});

	it('has a public channel', () => {
		const game = new Game(publicChannelStub);
		const queueMessageStub = sinon.stub(game.channelManager, 'queueMessage');

		expect(game.channelManager.getChannel({ channelName: 'PUBLIC_CHANNEL' })).to.equal(
			publicChannelStub
		);

		game.publicChannel({ announce: 'Hello World' });

		expect(queueMessageStub.calledWith({
			announce: 'Hello World',
			channelName: 'PUBLIC_CHANNEL',
		})).to.equal(true);
	});

	it('has card probabilities', () => {
		const game = new Game(publicChannelStub);

		expect(game.getCardProbabilities()).to.be.an('object');
	});

	it('has a ring', () => {
		const game = new Game(publicChannelStub);

		expect(game.ring).to.be.instanceOf(Ring);
		expect(game.ring.channelManager).to.equal(game.channelManager);
		expect(game.getRing()).to.equal(game.ring);
	});

	it('can look at the ring', () => {
		const game = new Game(publicChannelStub);
		const lookStub = sinon.stub(game.ring, 'look');

		game.lookAtRing('channel');

		expect(lookStub.calledOnce).to.equal(true);
		expect(lookStub.calledWith('channel', undefined, undefined)).to.equal(true);
	});

	it('can save state', () =>
		new Promise<void>(done => {
			const game = new Game(publicChannelStub);
			const saveStateStub = sinon.stub();

			game.saveState = saveStateStub;
			game.emit('stateChange');

			setImmediate(() => {
				expect(saveStateStub.calledOnce).to.equal(true);
				expect(saveStateStub.calledWith(
					zlib.gzipSync('{"name":"Game","options":{}}').toString('base64')
				)).to.equal(true);
				done();
			});
		}));

	it('can draw a card', () => {
		const game = new Game(publicChannelStub);
		const card = game.drawCard({ useless: 'option' });

		expect(card).to.be.instanceOf(BaseCard);
		expect(card.name).to.not.equal(BaseCard.name);
	});

	it('can draw a card for a specific monster', () => {
		const game = new Game(publicChannelStub);
		const canHoldCard = sinon.stub().returns(true);
		const monster = { canHoldCard };
		const card = game.drawCard({ useless: 'option' }, monster);

		expect(card).to.be.instanceOf(BaseCard);
		expect(canHoldCard.called).to.equal(true);
	});
});

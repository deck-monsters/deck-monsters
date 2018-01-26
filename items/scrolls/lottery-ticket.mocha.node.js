/* eslint-disable max-len */
const { expect, sinon } = require('../../shared/test-setup');
const proxyquire = require('proxyquire');

const pause = require('../../helpers/pause');
const randomCharacter = require('../../characters/helpers/random');

describe('./items/scrolls/lottery-ticket.js', () => {
	let channelStub;
	let pauseStub;
	let randomStub;
	let LotteryTicket;

	before(() => {
		channelStub = sinon.stub();
		pauseStub = sinon.stub(pause, 'setTimeout');
		randomStub = sinon.stub();
	});

	beforeEach(() => {
		channelStub.resolves();
		pauseStub.callsArg(0);
		randomStub.returns(1);

		LotteryTicket = proxyquire('./lottery-ticket', {
			'lodash.random': randomStub
		});
	});

	afterEach(() => {
		channelStub.reset();
		pauseStub.reset();
		randomStub.reset();
	});

	after(() => {
		pause.setTimeout.restore();
	});

	it('can be instantiated with defaults', () => {
		const lotteryTicket = new LotteryTicket();

		expect(lotteryTicket).to.be.an.instanceof(LotteryTicket);
		expect(lotteryTicket.numberOfUses).to.equal(1);
		expect(lotteryTicket.expired).to.be.false;
		expect(lotteryTicket.stats).to.equal('Usable 1 time.');
		expect(lotteryTicket.icon).to.equal('💰');
		expect(lotteryTicket.description).to.equal('Play the odds for a chance to win up to 3162 coins.');
	});

	it('can give you nothing', () => {
		const character = randomCharacter();

		const lotteryTicket = new LotteryTicket();

		randomStub.onCall(5).returns(5);
		randomStub.onCall(6).returns(5);
		randomStub.onCall(7).returns(5);
		randomStub.onCall(8).returns(5);
		randomStub.onCall(9).returns(5);

		character.coins = 50;

		return lotteryTicket.use({ character }).then(() => expect(character.coins).to.equal(50));
	});

	it('can make you win on 1 match', () => {
		const character = randomCharacter();

		const lotteryTicket = new LotteryTicket();

		randomStub.onCall(5).returns(12);
		randomStub.onCall(6).returns(12);
		randomStub.onCall(7).returns(12);
		randomStub.onCall(8).returns(12);

		character.coins = 50;

		return lotteryTicket.use({ character }).then(() => expect(character.coins).to.equal(82));
	});

	it('can make you win on 3 matches', () => {
		const character = randomCharacter();

		const lotteryTicket = new LotteryTicket();

		randomStub.onCall(5).returns(12);
		randomStub.onCall(6).returns(12);

		character.coins = 50;

		return lotteryTicket.use({ character }).then(() => expect(character.coins).to.equal(366));
	});

	it('can make you win big on all 5 matches', () => {
		const character = randomCharacter();

		const lotteryTicket = new LotteryTicket();

		character.coins = 50;

		return lotteryTicket.use({ character }).then(() => expect(character.coins).to.equal(3212));
	});
});

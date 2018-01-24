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
		randomStub.returns(1000);

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
	});

	it('can give you nothing', () => {
		const character = randomCharacter();

		const lotteryTicket = new LotteryTicket();

		randomStub.onCall(0).returns(1500);
		randomStub.onCall(1).returns(1501);
		randomStub.onCall(2).returns(1000);

		character.coins = 50;

		lotteryTicket.use(character);

		expect(character.coins).to.equal(50);
	});

	it('can make you win big', () => {
		const character = randomCharacter();

		const lotteryTicket = new LotteryTicket();

		randomStub.onCall(0).returns(1500);
		randomStub.onCall(1).returns(1500);
		randomStub.onCall(2).returns(1000);

		character.coins = 50;

		lotteryTicket.use(character);

		expect(character.coins).to.equal(1050);
	});
});

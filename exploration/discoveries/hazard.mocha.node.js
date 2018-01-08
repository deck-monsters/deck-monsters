const { expect, sinon } = require('../../shared/test-setup');

const HazardCard = require('./hazard');
const Basilisk = require('../../monsters/basilisk');

const pause = require('../../helpers/pause');

describe.only('./exploration/discoveries/hazard.js', () => {
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
		const hazard = new HazardCard();

		expect(hazard).to.be.an.instanceof(HazardCard);
		expect(hazard.icon).to.equal('⚠️');
	});

	it('can be played', () => {
		const hazard = new HazardCard();
		let monster = new Basilisk();
		const originalhp = monster.hp;

		monster = hazard.effect(monster);

		expect(monster.hp).to.be.below(originalhp);
	});
});

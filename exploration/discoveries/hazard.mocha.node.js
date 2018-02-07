const { expect, sinon } = require('../../shared/test-setup');

const HazardCard = require('./hazard');
const Basilisk = require('../../monsters/basilisk');
const Environment = require('../../monsters/environment');

const pause = require('../../helpers/pause');

describe('./exploration/discoveries/hazard.js', () => {
	let channelStub;
	let pauseStub;
	let hazard;
	let monster;

	before(() => {
		channelStub = sinon.stub();
		pauseStub = sinon.stub(pause, 'setTimeout');
	});

	beforeEach(() => {
		channelStub.resolves();
		pauseStub.callsArg(0);

		hazard = new HazardCard();
		monster = new Basilisk();
	});

	afterEach(() => {
		channelStub.reset();
		pauseStub.reset();
	});

	after(() => {
		pause.setTimeout.restore();
	});

	it('can be instantiated with defaults', () => {
		expect(hazard).to.be.an.instanceof(HazardCard);
		expect(hazard.icon).to.exist;
	});

	it('can be played', () => {
		const environment = new Environment();
		const originalhp = monster.hp;

		hazard.effect(environment, monster);

		expect(monster.hp).to.be.below(originalhp);
	});
});

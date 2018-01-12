const { expect, sinon } = require('../shared/test-setup');

const TurkeyThighCard = require('./turkey-thigh');
const pause = require('../helpers/pause');

const { BARBARIAN } = require('../helpers/classes');

describe('./cards/turkey-thigh.js', () => {
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
		const turkeyThigh = new TurkeyThighCard();

		expect(turkeyThigh).to.be.an.instanceof(TurkeyThighCard);
		expect(turkeyThigh.stats).to.equal('Hit: 1d20 vs AC / Damage: 2d4\n- or, below 1/4 health -\nHealth: 2d4\nPossiblity of Stroke of Luck'); // eslint-disable-line max-len
		expect(turkeyThigh.permittedClassesAndTypes).to.deep.equal([BARBARIAN]);
		expect(turkeyThigh.icon).to.equal('🍗');
		expect(turkeyThigh.damageDice).to.equal('2d4');
	});

	it('can be instantiated with options', () => {
		const turkeyThigh = new TurkeyThighCard({ icon: '🤷‍♂️', damageDice: '1d4' });

		expect(turkeyThigh).to.be.an.instanceof(TurkeyThighCard);
		expect(turkeyThigh.stats).to.equal('Hit: 1d20 vs AC / Damage: 1d4\n- or, below 1/4 health -\nHealth: 1d4\nPossiblity of Stroke of Luck'); // eslint-disable-line max-len
		expect(turkeyThigh.permittedClassesAndTypes).to.deep.equal([BARBARIAN]);
		expect(turkeyThigh.icon).to.equal('🤷‍♂️');
		expect(turkeyThigh.damageDice).to.equal('1d4');
	});
});

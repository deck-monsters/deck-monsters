const { expect, sinon } = require('../shared/test-setup');

const IocaneCard = require('./iocane');
const pause = require('../helpers/pause');

const { BARD, CLERIC } = require('../helpers/classes');

describe('./cards/iocane.js', () => {
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
		const iocane = new IocaneCard();

		expect(iocane).to.be.an.instanceof(IocaneCard);
		expect(iocane.stats).to.equal('Hit: 1d20 vs AC / Damage: 2d4\n- or, below 1/4 health -\nHealth: 2d4\nPossiblity of Stroke of Luck');
		expect(iocane.permittedClassesAndTypes).to.deep.equal([BARD, CLERIC]);
		expect(iocane.icon).to.equal('⚗️');
		expect(iocane.damageDice).to.equal('2d4');
	});

	it('can be instantiated with options', () => {
		const iocane = new IocaneCard({ icon: '🤷‍♂️', damageDice: '1d4' });

		expect(iocane).to.be.an.instanceof(IocaneCard);
		expect(iocane.stats).to.equal('Hit: 1d20 vs AC / Damage: 1d4\n- or, below 1/4 health -\nHealth: 1d4\nPossiblity of Stroke of Luck');
		expect(iocane.permittedClassesAndTypes).to.deep.equal([BARD, CLERIC]);
		expect(iocane.icon).to.equal('🤷‍♂️');
		expect(iocane.damageDice).to.equal('1d4');
	});
});

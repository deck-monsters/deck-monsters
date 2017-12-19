const { expect, sinon } = require('../shared/test-setup');

const Gladiator = require('./gladiator');
const pause = require('../helpers/pause');

describe('./monsters/gladiator.js', () => {
	let pauseStub;

	before(() => {
		pauseStub = sinon.stub(pause, 'setTimeout');
	});

	beforeEach(() => {
		pauseStub.callsArg(0);
	});

	afterEach(() => {
		pauseStub.reset();
	});

	after(() => {
		pause.setTimeout.restore();
	});

	it('can be instantiated with defaults', () => {
		const gladiator = new Gladiator();

		expect(gladiator).to.be.an.instanceof(Gladiator);
		expect(gladiator.name).to.equal('Gladiator');
		expect(gladiator.givenName).to.be.a('string');
		expect(gladiator.options).to.deep.contain({
			attackModifier: 1,
			damageModifier: 1,
			color: 'leather',
			icon: '💪'
		});
	});

	it('can track killed creatures', () => {
		const gladiator = new Gladiator();

		expect(gladiator.killed).to.deep.equal([]);

		gladiator.killed = 'one';
		gladiator.killed = 'two';

		expect(gladiator.killed).to.deep.equal(['one', 'two']);

		gladiator.endEncounter();

		expect(gladiator.killed).to.deep.equal([]);
	});
});

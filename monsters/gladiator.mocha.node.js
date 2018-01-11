const { expect, sinon } = require('../shared/test-setup');

const Gladiator = require('./gladiator');
const { CLERIC, FIGHTER } = require('../helpers/classes');
const { GLADIATOR, BASILISK } = require('../helpers/creature-types');
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
			dexModifier: 1,
			strengthModifier: 1,
			intModifier: 1,
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

	it('can hold gladiator only cards', () => {
		const gladiator = new Gladiator();

		const testCard = { permittedClassesAndTypes: [GLADIATOR] };

		expect(gladiator.canHold(testCard)).to.be.true;
	});

	it('can not hold Basilisk only cards', () => {
		const gladiator = new Gladiator();

		const testCard = { permittedClassesAndTypes: [BASILISK] };

		expect(gladiator.canHold(testCard)).to.be.false;
	});

	it('can hold fighter only cards', () => {
		const gladiator = new Gladiator();

		const testCard = { permittedClassesAndTypes: [FIGHTER] };

		expect(gladiator.canHold(testCard)).to.be.true;
	});

	it('can not hold cleric only cards', () => {
		const gladiator = new Gladiator();

		const testCard = { permittedClassesAndTypes: [CLERIC] };

		expect(gladiator.canHold(testCard)).to.be.false;
	});

	it('can hold level appropriate cards', () => {
		const gladiator = new Gladiator();

		const testCard = { level: 0 };

		expect(gladiator.canHold(testCard)).to.be.true;
	});

	it('can not hold level inappropriate cards', () => {
		const gladiator = new Gladiator();

		const testCard = { level: 5 };

		expect(gladiator.canHold(testCard)).to.be.false;
	});
});

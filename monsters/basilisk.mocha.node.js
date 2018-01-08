const { expect, sinon } = require('../shared/test-setup');

const Basilisk = require('./basilisk');
const pause = require('../helpers/pause');

describe('./monsters/basilisk.js', () => {
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
		const basilisk = new Basilisk();

		expect(basilisk).to.be.an.instanceof(Basilisk);
		expect(basilisk.name).to.equal('Basilisk');
		expect(basilisk.givenName).to.be.a('string');
		expect(basilisk.options).to.deep.contain({
			attackModifier: -1,
			damageModifier: 3,
			color: 'tan',
			icon: '🐍'
		});
	});

	it('can be instantiated with higher XP', () => {
		const basilisk = new Basilisk({ xp: 1000 });

		expect(basilisk).to.be.an.instanceof(Basilisk);
		expect(basilisk.name).to.equal('Basilisk');
		expect(basilisk.givenName).to.be.a('string');
		expect(basilisk.options).to.deep.contain({
			attackModifier: -1,
			damageModifier: 3,
			color: 'tan',
			icon: '🐍',
			xp: 1000
		});
	});

	it('can tell if it is bloodied', () => {
		const basilisk = new Basilisk();

		expect(basilisk.bloodied).to.equal(false);

		basilisk.hp = basilisk.bloodiedValue + 1;

		expect(basilisk.bloodied).to.equal(false);

		basilisk.hp = basilisk.bloodiedValue;

		expect(basilisk.bloodied).to.equal(true);

		basilisk.hp = 1;

		expect(basilisk.bloodied).to.equal(true);
	});

	it('can tell if it is destroyed', () => {
		const basilisk = new Basilisk();

		expect(basilisk.destroyed).to.equal(false);

		basilisk.hp = -basilisk.bloodiedValue - 1;

		expect(basilisk.destroyed).to.equal(true);
	});

	it('can be hit', () => {
		const basilisk = new Basilisk();

		const beforeHP = basilisk.hp;

		basilisk.hit(1, basilisk);

		expect(basilisk.hp).to.equal(beforeHP - 1);
	});

	it('can die from being hit', () => {
		const basilisk = new Basilisk();

		basilisk.hp = 1;

		expect(basilisk.dead).to.be.false;

		basilisk.hit(1, basilisk);

		expect(basilisk.dead).to.be.true;
	});

	it('can not be hit while dead', () => {
		const basilisk = new Basilisk();

		const basiliskProto = Object.getPrototypeOf(basilisk);
		const creatureProto = Object.getPrototypeOf(basiliskProto);
		const dieSpy = sinon.spy(creatureProto, 'die');

		expect(dieSpy.notCalled).to.be.true;

		basilisk.die();

		expect(dieSpy.calledOnce).to.be.true;

		expect(basilisk.dead).to.be.true;

		basilisk.hit(1, basilisk);

		expect(dieSpy.calledOnce).to.be.true;

		dieSpy.restore();
		expect(basilisk.hp).to.equal(0);
	});
});

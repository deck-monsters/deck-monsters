import { expect } from 'chai';
import sinon from 'sinon';
import Basilisk from './basilisk.js';

describe('monsters/basilisk', () => {
	afterEach(() => {
		sinon.restore();
	});

	it('can be instantiated with defaults', () => {
		const basilisk = new Basilisk();

		expect(basilisk).to.be.instanceOf(Basilisk);
		expect(basilisk.name).to.equal('Basilisk');
		expect(basilisk.givenName).to.be.a('string');
		expect(basilisk.options).to.include({
			dexModifier: -1,
			strModifier: 2,
			intModifier: 1,
			color: 'tan',
			icon: '🐍',
		});
	});

	it('can be instantiated with higher XP', () => {
		const basilisk = new Basilisk({ xp: 1000 });

		expect(basilisk).to.be.instanceOf(Basilisk);
		expect(basilisk.name).to.equal('Basilisk');
		expect(basilisk.givenName).to.be.a('string');
		expect(basilisk.options).to.include({
			dexModifier: -1,
			strModifier: 2,
			intModifier: 1,
			color: 'tan',
			icon: '🐍',
			xp: 1000,
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

	it('can be hit', async () => {
		const basilisk = new Basilisk();
		const beforeHP = basilisk.hp;

		await basilisk.hit(1, basilisk);

		expect(basilisk.hp).to.equal(beforeHP - 1);
	});

	it('can die from being hit', async () => {
		const basilisk = new Basilisk();
		const basiliskProto = Object.getPrototypeOf(basilisk);
		const creatureProto = Object.getPrototypeOf(basiliskProto);
		const dieSpy = sinon.spy(creatureProto, 'die');

		basilisk.hp = 1;

		expect(basilisk.dead).to.equal(false);

		await basilisk.hit(1, basilisk);

		expect(dieSpy.calledOnce).to.equal(true);
		expect(basilisk.dead).to.equal(true);

		dieSpy.restore();
	});

	it('does not re-die if already dead', async () => {
		const basilisk = new Basilisk();
		const basiliskProto = Object.getPrototypeOf(basilisk);
		const creatureProto = Object.getPrototypeOf(basiliskProto);
		const dieSpy = sinon.spy(creatureProto, 'die');

		expect(dieSpy.called).to.equal(false);

		await basilisk.die();
		expect(dieSpy.calledOnce).to.equal(true);
		expect(basilisk.dead).to.equal(true);

		await basilisk.hit(1, basilisk);
		expect(dieSpy.calledOnce).to.equal(true);
		expect(basilisk.hp).to.equal(-1);

		dieSpy.restore();
	});
});

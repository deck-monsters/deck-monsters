import { expect } from 'chai';
import Gladiator from './gladiator.js';
import { CLERIC, FIGHTER } from '../constants/creature-classes.js';
import { GLADIATOR, BASILISK } from '../constants/creature-types.js';

describe('monsters/gladiator', () => {
	it('can be instantiated with defaults', () => {
		const gladiator = new Gladiator();

		expect(gladiator).to.be.instanceOf(Gladiator);
		expect(gladiator.name).to.equal('Gladiator');
		expect(gladiator.givenName).to.be.a('string');
		expect(gladiator.options).to.include({
			dexModifier: 1,
			strModifier: 1,
			intModifier: 0,
			color: 'leather',
			icon: '💪',
		});
	});

	it('can track killed creatures', () => {
		const gladiator = new Gladiator();

		expect(gladiator.killed).to.deep.equal([]);

		gladiator.killed = 'one' as any;
		gladiator.killed = 'two' as any;

		expect(gladiator.killed).to.deep.equal(['one', 'two']);

		gladiator.endEncounter();

		expect(gladiator.killed).to.deep.equal([]);
	});

	it('can hold gladiator-only cards', () => {
		const gladiator = new Gladiator();
		const testCard = { permittedClassesAndTypes: [GLADIATOR] };

		expect(gladiator.canHold(testCard)).to.equal(true);
	});

	it('cannot hold basilisk-only cards', () => {
		const gladiator = new Gladiator();
		const testCard = { permittedClassesAndTypes: [BASILISK] };

		expect(gladiator.canHold(testCard)).to.equal(false);
	});

	it('can hold fighter-only cards', () => {
		const gladiator = new Gladiator();
		const testCard = { permittedClassesAndTypes: [FIGHTER] };

		expect(gladiator.canHold(testCard)).to.equal(true);
	});

	it('cannot hold cleric-only cards', () => {
		const gladiator = new Gladiator();
		const testCard = { permittedClassesAndTypes: [CLERIC] };

		expect(gladiator.canHold(testCard)).to.equal(false);
	});

	it('can hold level-appropriate cards', () => {
		const gladiator = new Gladiator();
		const testCard = { level: 0 };

		expect(gladiator.canHold(testCard)).to.equal(true);
	});

	it('cannot hold level-inappropriate cards', () => {
		const gladiator = new Gladiator();
		const testCard = { level: 5 };

		expect(gladiator.canHold(testCard)).to.equal(false);
	});
});

import { expect } from 'chai';
import WeepingAngel from './weeping-angel.js';
import { WEEPING_ANGEL } from '../constants/creature-types.js';

describe('monsters/weeping-angel', () => {
	it('can be instantiated with defaults', () => {
		const weepingAngel = new WeepingAngel();

		expect(weepingAngel).to.be.instanceOf(WeepingAngel);
		expect(weepingAngel.name).to.equal('WeepingAngel');
		expect(weepingAngel.creatureType).to.equal(WEEPING_ANGEL);
		expect(weepingAngel.givenName).to.be.a('string');
		expect(weepingAngel.options).to.include({
			dexModifier: 1,
			strModifier: -1,
			intModifier: 2,
			color: 'stone gray',
			icon: '🌟',
		});
	});

	it('can be instantiated with higher XP', () => {
		const weepingAngel = new WeepingAngel({ xp: 1000 });

		expect(weepingAngel).to.be.instanceOf(WeepingAngel);
		expect(weepingAngel.name).to.equal('WeepingAngel');
		expect(weepingAngel.creatureType).to.equal(WEEPING_ANGEL);
		expect(weepingAngel.givenName).to.be.a('string');
		expect(weepingAngel.options).to.include({
			dexModifier: 1,
			strModifier: -1,
			intModifier: 2,
			color: 'stone gray',
			icon: '🌟',
			xp: 1000,
		});
	});

	it('can tell if it is bloodied', () => {
		const weepingAngel = new WeepingAngel();

		expect(weepingAngel.bloodied).to.equal(false);

		weepingAngel.hp = weepingAngel.bloodiedValue + 1;
		expect(weepingAngel.bloodied).to.equal(false);

		weepingAngel.hp = weepingAngel.bloodiedValue;
		expect(weepingAngel.bloodied).to.equal(true);

		weepingAngel.hp = 1;
		expect(weepingAngel.bloodied).to.equal(true);
	});

	it('can tell if it is destroyed', () => {
		const weepingAngel = new WeepingAngel();

		expect(weepingAngel.destroyed).to.equal(false);

		weepingAngel.hp = -weepingAngel.bloodiedValue - 1;
		expect(weepingAngel.destroyed).to.equal(true);
	});
});

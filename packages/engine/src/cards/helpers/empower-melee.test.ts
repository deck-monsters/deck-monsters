import { expect } from 'chai';

import { empowerMelee, canEmpower } from './empower-melee.js';
import { HitCard } from '../hit.js';
import { HealCard } from '../heal.js';
import Dragon from '../../monsters/dragon.js';
import Minotaur from '../../monsters/minotaur.js';

describe('./cards/helpers/empower-melee.ts', () => {
	it('adds the bonus to the attacker\'s rolls only, on the modifier', () => {
		const dragon: any = new Dragon();
		const foe: any = new Minotaur();
		const hit: any = new HitCard();

		expect(empowerMelee(hit, dragon, { hitBonus: 2, damageDice: '1d6' })).to.equal(true);

		const attack = hit.getAttackRoll(dragon);
		expect(attack.modifier).to.equal(dragon.dexModifier + 2);

		const damage = hit.getDamageRoll(dragon);
		expect(damage.modifier).to.be.within(dragon.strModifier + 1, dragon.strModifier + 6);

		// On a natural 1 Hit rolls damage for the target against the attacker: no bonus.
		expect(hit.getDamageRoll(foe).modifier).to.equal(foe.strModifier);
	});

	it('keeps the damage bonus on a natural 20, which recomputes damage from the modifier', () => {
		const dragon: any = new Dragon();
		const hit: any = new HitCard();
		empowerMelee(hit, dragon, { damageDice: '1d6' });

		const damage = hit.rollForDamage(dragon, undefined, true);
		expect(damage.result).to.be.within(6 + dragon.strModifier + 1, 6 + dragon.strModifier + 6);
	});

	it('leaves cards that do not roll a melee attack alone', () => {
		const heal: any = new HealCard();
		expect(canEmpower(heal)).to.equal(false);
		expect(empowerMelee(heal, new Dragon(), { hitBonus: 2 })).to.equal(false);
	});
});

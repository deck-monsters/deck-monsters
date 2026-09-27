import { expect } from 'chai';

import { empowerMelee, canEmpower } from './empower-melee.js';
import { HitCard } from '../hit.js';
import { HealCard } from '../heal.js';
import { HitHarder } from '../hit-harder.js';
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

	it('reaches Hit Harder\'s paired roll, and the better roll it deals', () => {
		const dragon: any = new Dragon();
		const card: any = new HitHarder();
		let spent = 0;
		empowerMelee(card, dragon, { damageDice: '1d6', onDamageBonus: () => { spent += 1; } });

		const { betterRoll } = card.getDamageRoll(dragon);
		expect(betterRoll.modifier).to.be.within(dragon.strModifier + 1, dragon.strModifier + 6);
		expect(Number.isNaN(card.getDamageRoll(dragon).modifier)).to.equal(false);
		expect(spent).to.equal(1);
	});

	it('adds the bonus once when Hit Harder\'s two rolls tie and share one object', () => {
		const dragon: any = new Dragon();
		const card: any = new HitHarder();
		const shared = { modifier: 0, result: 3, naturalRoll: { result: 3 } };
		card.getDamageRoll = () => ({ betterRoll: shared, worseRoll: shared });
		empowerMelee(card, dragon, { damageDice: '1d6' });

		const { betterRoll } = card.getDamageRoll(dragon);
		expect(betterRoll.modifier).to.be.within(1, 6);
	});

	it('adds the damage die once per play, even for a card that rolls damage twice', () => {
		const dragon: any = new Dragon();
		const hit: any = new HitCard();
		empowerMelee(hit, dragon, { damageDice: '1d6' });

		hit.getDamageRoll(dragon);
		expect(hit.getDamageRoll(dragon).modifier, 'a second roll (Horn Gore\'s second horn)').to.equal(dragon.strModifier);
	});

	it('leaves cards that do not roll a melee attack alone', () => {
		const heal: any = new HealCard();
		expect(canEmpower(heal)).to.equal(false);
		expect(empowerMelee(heal, new Dragon(), { hitBonus: 2 })).to.equal(false);
	});
});

import { expect } from 'chai';

import { HealCard } from './heal.js';
import { ReviveCard } from './revive.js';
import Minotaur from '../monsters/minotaur.js';
import WeepingAngel from '../monsters/weeping-angel.js';

/**
 * A heal's INT modifier: a bonus fades by one per play and then resets; a penalty counts as
 * zero. A Concussion took a low-level Unicorn to -2 INT, and every Heal (1d4) paid all of it
 * again, since a negative value was recomputed instead of fading.
 */
describe('./cards/heal.ts', () => {
	it('never subtracts an INT penalty from a heal', () => {
		const player = new Minotaur({ name: 'healer' });
		(player as any).setModifier('int', -2);
		expect((player as any).intModifier).to.be.below(0);

		const heal = new HealCard();
		for (let play = 0; play < 3; play += 1) {
			expect(heal.getHealRoll(player).modifier, `play ${play + 1}`).to.equal(0);
		}
	});

	it('still lets an INT bonus fade by one per play, then reset', () => {
		const player = new WeepingAngel({ name: 'healer' });
		const bonus = (player as any).intModifier as number;
		expect(bonus).to.be.above(1);

		const heal = new HealCard();
		const modifiers = Array.from({ length: bonus + 2 }, () => heal.getHealRoll(player).modifier);
		const fading = Array.from({ length: bonus + 1 }, (_, play) => bonus - play);
		expect(modifiers).to.deep.equal([...fading, bonus]);
	});

	it("keeps a card's own heal bonus for a cursed healer", () => {
		const player = new Minotaur({ name: 'healer' });
		(player as any).setModifier('int', -2);
		expect(new ReviveCard().getHealRoll(player).modifier).to.equal(3);
	});
});

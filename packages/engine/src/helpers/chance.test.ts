import { expect } from 'chai';

import { chance } from './chance.js';

describe('./helpers/chance.ts', () => {
	it('flags natural 1s and 20s on a crit d20', () => {
		const rolls = Array.from({ length: 400 }, () => chance.roll({ primaryDice: '1d20', crit: true }));
		expect(rolls.some(r => r.curseOfLoki)).to.equal(true);
		expect(rolls.some(r => r.strokeOfLuck)).to.equal(true);
		rolls.filter(r => r.curseOfLoki).forEach(r => expect(r.naturalRoll.result).to.equal(1));
		rolls.filter(r => r.strokeOfLuck).forEach(r => expect(r.naturalRoll.result).to.equal(20));
	});

	// Owner, 2026-10-14: natural 1s and 20s belong to the d20 alone, never a d4 or d6 damage die.
	it('never flags a crit on any other die, even when asked to', () => {
		for (const primaryDice of ['1d4', '1d6', '2d6', '1d100']) {
			const rolls = Array.from({ length: 200 }, () => chance.roll({ primaryDice, crit: true }));
			expect(rolls.some(r => r.curseOfLoki || r.strokeOfLuck), primaryDice).to.equal(false);
		}
	});
});

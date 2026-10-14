import { expect } from 'chai';

import all from './helpers/all.js';
import { STICKETH_TO_HIT_BONUS } from './sticketh.js';

/*
 * Owner, 2026-10-14: every attack card rolls the stat its text names. The Kalevala rolled dex
 * against int while its text said "1d20 vs int", and Berserk's text promised str while it rolled
 * dex. Each card's `attackStat` drives both; this test catches a roll that drifts from it.
 */
describe('attack stats: the roll adds the stat the card names', () => {
	// Distinct modifiers, so the roll's modifier says which one it used.
	const player: any = { dexModifier: 1, strModifier: 2, intModifier: 3, encounterModifiers: {}, pronouns: {} };
	const target: any = { creatureType: 'Dragon', encounterModifiers: {} };
	const extra: Record<string, number> = { Sticketh: STICKETH_TO_HIT_BONUS };

	for (const Card of all as any[]) {
		const card: any = new Card();
		if (typeof card.getAttackRoll !== 'function' || !card.attackStat) continue;
		it(`${Card.cardType} rolls 1d20 + ${card.attackStat}, and says so`, () => {
			const rolled = card.getAttackRoll(player, target);
			const matchup = card.getAttackModifier?.(target) ?? 0;
			expect(rolled.modifier - matchup).to.equal(player[`${card.attackStat}Modifier`] + (extra[Card.cardType] ?? 0));
			expect(card.stats).to.include(`+ ${card.attackStat}`);
		});
	}

	it('rolls the Kalevala with int, so a Feline Companion helps it', () => {
		const kalevala: any = new ((all as any[]).find(Card => Card.cardType === 'The Kalevala'))();
		expect(kalevala.attackStat).to.equal('int');
		expect(kalevala.targetProp).to.equal('int');
	});
});

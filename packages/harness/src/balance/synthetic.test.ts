import '../set-env.js';
import { expect } from 'chai';
import { allCards, drawCard, engineReady, getCardClassByTypeName } from '@deck-monsters/engine';

import { makeCard, syntheticKinds } from './synthetic-cards.js';
import { referenceOffsets, REFERENCE_CREATURE_TYPE } from './reference.js';
import { simulate } from '../simulate.js';

/**
 * Roadmap 34 task 3: synthetic cards exist only in the harness, the null card does nothing,
 * and the reference chassis has the median stats and no creature type.
 */
describe('balance/synthetic cards and reference chassis', () => {
	before(async () => {
		await engineReady;
	});

	it('are never part of the game: not registered, never drawn', () => {
		for (const kind of syntheticKinds()) {
			expect(() => getCardClassByTypeName(`Ideal:${kind}`), kind).to.throw('Unknown card type name');
		}
		const engineTypes = (allCards as unknown as Array<{ cardType: string }>).map(C => C.cardType);
		expect(engineTypes.some(type => type.startsWith('Ideal:'))).to.equal(false);
		for (let i = 0; i < 300; i += 1) {
			const card = drawCard({}) as { cardType: string };
			expect(card.cardType.startsWith('Ideal:')).to.equal(false);
		}
	});

	it('builds from plain-JSON names, with options', () => {
		const strike = makeCard('Ideal:Strike:{"damageDice":"2d6"}') as { cardType: string; damageDice: string };
		expect(strike.cardType).to.equal('Ideal:Strike');
		expect(strike.damageDice).to.equal('2d6');
		expect((makeCard('Hit') as { cardType: string }).cardType).to.equal('Hit');
		expect(() => makeCard('Ideal:Nope')).to.throw('Unknown synthetic card');
	});

	it('a hand of null cards never deals damage, so every fight is a draw', async () => {
		const nulls = Array.from({ length: 9 }, () => 'Ideal:Null');
		const res = await simulate({
			monsters: [
				{ type: 'Gladiator', level: 3, deck: nulls, chassis: 'reference' },
				{ type: 'Minotaur', level: 3, deck: nulls, chassis: 'reference' },
			],
			fights: 3,
			seed: 7,
		});
		expect(res.drawRate).to.equal(100);
	});

	it('the reference chassis uses the median offsets and has no creature type', async () => {
		const offsets = referenceOffsets();
		expect(offsets).to.include.keys('dexModifier', 'strModifier', 'intModifier', 'hpVariance', 'acVariance');
		let seen: { creatureType?: string; options: Record<string, unknown> } | undefined;
		await simulate({
			monsters: [
				{ type: 'Gladiator', level: 3, deck: ['Hit'], chassis: 'reference' },
				{ type: 'Minotaur', level: 3, deck: ['Hit'] },
			],
			fights: 1,
			seed: 3,
			onContestants: contestants => {
				seen = (contestants[0] as unknown as { monster: typeof seen }).monster;
			},
		});
		// onContestants runs before the chassis is applied, so read it after the fight.
		expect(seen?.creatureType).to.equal(REFERENCE_CREATURE_TYPE);
		expect(seen?.options.dexModifier).to.equal(offsets.dexModifier);
		expect(seen?.options.intModifier).to.equal(offsets.intModifier);
	});
});

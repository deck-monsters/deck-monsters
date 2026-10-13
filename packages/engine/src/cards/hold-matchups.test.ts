import { expect } from 'chai';

import all from './helpers/all.js';
import { ImmobilizeCard } from './immobilize.js';
import { StickethCard } from './sticketh.js';
import { MONSTER_TYPES } from '../constants/monster-types.js';

/*
 * Owner, 2026-10-13: every card in the hold family has three clear tiers, weak < neutral <
 * strong, with explicit strong and weak lists and every other monster type neutral. Horn Gore
 * used to roll "strong against" at -2, below neutral's 0, and the Forked Metal Rod gave weak +1
 * and neutral 0 (fight #114).
 */
const holdCards = (all as any[]).filter(
	Card => Card.prototype instanceof ImmobilizeCard || Card === ImmobilizeCard,
).filter(Card => Card !== StickethCard);

describe('hold-family matchups', () => {
	it('covers the whole family', () => {
		expect(holdCards.map(Card => Card.cardType)).to.include.members([
			'Coil', 'Constrict', 'Horn Gore', 'Forked Stick', 'Forked Metal Rod', 'Mesmerize', 'Enthrall', 'Entrance',
		]);
	});

	for (const Card of holdCards) {
		it(`${Card.cardType}: weak < neutral < strong, and no type in two tiers`, () => {
			const card = new Card();
			const strong: string[] = card.strongAgainstCreatureTypes;
			const weak: string[] = card.weakAgainstCreatureTypes;
			const useless: string[] = card.uselessAgainstCreatureTypes;
			for (const type of strong) expect(weak, type).to.not.include(type);
			for (const type of [...strong, ...weak]) expect(useless, type).to.not.include(type);

			const neutral = MONSTER_TYPES.filter(type => ![...strong, ...weak, ...useless].includes(type));
			const at = (type: string) => card.getAttackModifier({ creatureType: type });
			const neutralValue = at(neutral[0] ?? 'nobody');
			for (const type of weak) expect(at(type), `${type} (weak)`).to.be.below(neutralValue);
			for (const type of strong) expect(at(type), `${type} (strong)`).to.be.above(neutralValue);
			for (const type of neutral) expect(at(type), `${type} (neutral)`).to.equal(neutralValue);
		});
	}

	it('lets a horn crack a statue: Horn Gore is strong against Weeping Angels', () => {
		const hornGore = new (holdCards.find(Card => Card.cardType === 'Horn Gore'))();
		expect(hornGore.strongAgainstCreatureTypes).to.include('Weeping Angel');
	});
});

import { expect } from 'chai';

import { cardRefusalReason, equipResultMessage } from './equip-message.js';

describe('characters/helpers/equip-message', () => {
	describe('cardRefusalReason', () => {
		const monster = (over: Record<string, unknown> = {}) => ({ cards: [] as string[], cardSlots: 3, ...over });

		it('checks in the order equipCards does: fight, full deck, class, copies', () => {
			const full = monster({ cards: ['A', 'B', 'C'] });
			// A full deck of a class that cannot hold the card says full first, as the server will.
			expect(cardRefusalReason({ cardName: 'Hit', monster: full, compatible: false })).to.equal('deck_full');
			expect(cardRefusalReason({ cardName: 'Hit', monster: monster(), compatible: false })).to.equal('cannot_hold');
			expect(cardRefusalReason({ cardName: 'Hit', monster: monster({ inEncounter: true, cards: ['A', 'B', 'C'] }), compatible: false })).to.equal('fighting');
			expect(cardRefusalReason({ cardName: 'Hit', monster: monster({ cardSlots: 9, cards: ['Hit', 'Hit', 'Hit', 'Hit'] }), compatible: true })).to.equal('max_copies');
			expect(cardRefusalReason({ cardName: 'Hit', monster: monster(), compatible: true })).to.equal(null);
		});

		it('treats unknown slots (0) as unknown, not full', () => {
			expect(cardRefusalReason({ cardName: 'Hit', monster: monster({ cardSlots: 0 }), compatible: true })).to.equal(null);
		});
	});

	describe('equipResultMessage', () => {
		const base = { skippedCards: [] as string[], cardCount: 3, cardSlots: 9 };

		it('names one card and the deck count', () => {
			expect(equipResultMessage({ monsterName: 'Stonefang', cardNames: ['Hit'], result: base }))
				.to.equal('Equipped Hit on Stonefang. Stonefang holds 3 of 9 cards.');
		});

		it('counts several cards', () => {
			expect(equipResultMessage({ monsterName: 'Stonefang', cardNames: ['Hit', 'Hit', 'Heal'], result: base }))
				.to.equal('Equipped 3 cards on Stonefang. Stonefang holds 3 of 9 cards.');
		});

		it('says one refusal per card and reason, not one per copy', () => {
			const skipped = Array.from({ length: 4 }, () => ({ cardName: 'Hit', reason: 'deck_full' }));
			const message = equipResultMessage({
				monsterName: 'Stonefang',
				cardNames: ['Hit', 'Hit', 'Hit', 'Hit', 'Heal'],
				result: { ...base, skippedCards: ['Hit', 'Hit', 'Hit', 'Hit'], skipped },
			});

			expect(message.match(/Hit can't go on Stonefang/g)).to.have.length(1);
			expect(message.startsWith('Equipped Heal on Stonefang.')).to.equal(true);
		});

		it('gives a different reason for the same card its own sentence', () => {
			const message = equipResultMessage({
				monsterName: 'S',
				cardNames: ['Hit', 'Hit'],
				result: { skippedCards: ['Hit', 'Hit'], skipped: [{ cardName: 'Hit', reason: 'max_copies' }, { cardName: 'Hit', reason: 'deck_full' }] },
			});

			expect(message.match(/Hit can't go on S/g)).to.have.length(2);
		});

		it('leaves the count out when an older server sends none, and falls back without reasons', () => {
			expect(equipResultMessage({ monsterName: 'S', cardNames: ['Hit', 'Heal'], result: { skippedCards: ['Heal'] } }))
				.to.match(/^Equipped Hit on S\. Heal can't go on S: /);
		});
	});
});

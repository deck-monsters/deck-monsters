import { expect } from 'chai';

import { getBackRoom, getCards, getItems } from './stock.js';

describe('./items/store/stock.ts', () => {
	describe('getBackRoom', () => {
		it('can get special items and cards for the back room', () => {
			const backRoom = getBackRoom();

			expect(backRoom.length).to.be.at.least(0);
			expect(backRoom.length).to.be.below(7);

			backRoom.forEach((entry) => {
				expect((entry.constructor as any).notForSale).to.equal(true);
				expect((entry.constructor as any).neverForSale).to.not.equal(true);
			});
		});

		it('can include rare cards, not just items, over enough draws', () => {
			// `canHoldBackRoom.canHoldCard` existed before this change but was never wired
			// up (docs/roadmap/10b-bugs-fixed.md #5) — assert cards actually show up, not
			// just that the filter shape is technically correct.
			let sawCard = false;

			for (let i = 0; i < 40 && !sawCard; i += 1) {
				const backRoom = getBackRoom();
				sawCard = backRoom.some((entry: any) => Boolean(entry.cardType));
			}

			expect(sawCard).to.equal(true);
		});
	});

	describe('getCards', () => {
		it('can get a set of cards', () => {
			const cards = getCards();

			expect(cards.length).to.be.at.least(4);
			expect(cards.length).to.be.below(11);

			cards.forEach((card) => {
				expect(card.cardType).to.be.a('string');
				expect((card.constructor as any).notForSale).to.not.equal(true);
				expect((card.constructor as any).neverForSale).to.not.equal(true);
			});
		});

		it('never leaks a notForSale or neverForSale card onto the shelf, over many draws', () => {
			for (let i = 0; i < 25; i += 1) {
				const cards = getCards();

				cards.forEach((card) => {
					expect((card.constructor as any).notForSale).to.not.equal(true);
					expect((card.constructor as any).neverForSale).to.not.equal(true);
				});
			}
		});
	});

	describe('getItems', () => {
		it('can get a set of items', () => {
			const items = getItems();

			expect(items.length).to.be.above(4);
			expect(items.length).to.be.below(21);

			items.forEach((item) => {
				expect((item.constructor as any).notForSale).to.not.equal(true);
				expect((item.constructor as any).neverForSale).to.not.equal(true);
			});
		});
	});
});

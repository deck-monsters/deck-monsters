const { expect } = require('../../shared/test-setup');

const { getBackRoom, getCards } = require('./stock');

describe('./items/store/stock.js', () => {
	describe('getBackRoom', () => {
		it('can get a special item for the back room', () => {
			const backRoom = getBackRoom();

			expect(backRoom.length).to.equal(1);

			backRoom.forEach((item) => {
				expect(item.constructor.notForSale).to.equal(true);
				expect(item.constructor.neverForSale).to.not.equal(true);
			});
		});
	});

	describe('getCards', () => {
		it('can get a set of cards', () => {
			const cards = getCards();

			expect(cards.length).to.equal(20);

			cards.forEach((item) => {
				expect(item.constructor.notForSale).to.not.equal(true);
				expect(item.constructor.neverForSale).to.not.equal(true);
			});
		});
	});
});

import { expect } from 'chai';

import { getBackRoom, getItems } from './stock.js';

describe('./items/store/stock.ts', () => {
	describe('getBackRoom', () => {
		it('can get special items for the back room', () => {
			const backRoom = getBackRoom();

			expect(backRoom.length).to.be.at.least(0);
			expect(backRoom.length).to.be.below(7);

			backRoom.forEach((item) => {
				expect((item.constructor as any).notForSale).to.equal(true);
				expect((item.constructor as any).neverForSale).to.not.equal(true);
			});
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

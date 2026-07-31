import { expect } from 'chai';
import sinon from 'sinon';

import { generateShop, resolveShop } from './shop.js';

describe('./items/store/shop.ts', () => {
	let clock: sinon.SinonFakeTimers;

	beforeEach(() => {
		clock = sinon.useFakeTimers({ toFake: ['Date'] });
	});

	afterEach(() => {
		clock.restore();
	});

	describe('generateShop', () => {
		it('can generate a shop', () => {
			const shop = generateShop(Date.now());

			expect(shop.name).to.be.a('string');
			expect(shop.adjective).to.be.a('string');
			expect(shop.priceOffset).to.be.below(1);
			expect(shop.backRoomOffset).to.be.below(10);
			expect(shop.items.length).to.be.above(4);
			expect(shop.items.length).to.be.below(21);
			expect(shop.pronouns).to.be.an('object');
			expect(shop.closingTime).to.be.instanceOf(Date);
			expect(shop.closingTime.getTime()).to.be.above(Date.now());
		});
	});

	describe('resolveShop', () => {
		it('returns a freshly generated shop when there is no stored shop', () => {
			const shop = resolveShop(undefined, Date.now());

			expect(shop.name).to.be.a('string');
		});

		it('returns the stored shop while it is still before its closing time', () => {
			const stored = generateShop(Date.now());
			const laterButStillOpen = stored.closingTime.getTime() - 1;

			const resolved = resolveShop(stored, laterButStillOpen);

			expect(resolved).to.equal(stored);
		});

		it('returns a fresh shop once the stored shop has passed its closing time', () => {
			const stored = generateShop(Date.now());
			const afterClosing = stored.closingTime.getTime() + 1;

			const resolved = resolveShop(stored, afterClosing);

			expect(resolved).to.not.equal(stored);
			expect(resolved.closingTime.getTime()).to.be.above(afterClosing);
		});
	});
});

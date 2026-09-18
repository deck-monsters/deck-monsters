import { expect } from 'chai';

import { getItemCountsWithPrice } from './counts.js';

describe('./items/helpers/counts.ts', () => {
	describe('getItemCountsWithPrice', () => {
		it('prices items keyed by itemType, unchanged from before', () => {
			const counts = getItemCountsWithPrice(
				[
					{ itemType: 'Bandage', cost: 10 },
					{ itemType: 'Bandage', cost: 10 },
					{ itemType: 'Potion', cost: 20 }
				],
				2
			);

			expect(counts).to.deep.equal({
				Bandage: { count: 2, cost: 20 },
				Potion: { count: 1, cost: 40 }
			});
		});

		// Regression for the back room mixing items and cards in one pool
		// (items/store/stock.ts `getBackRoom`): keying strictly on `item.itemType`
		// collapsed every card (which has no `itemType`) under the single key
		// `"undefined"`, mispricing them all together instead of by their own cost.
		// See docs/roadmap/10b-bugs-fixed.md #5.
		it('prices a mixed pool of items and cards separately, keyed like getItemKey', () => {
			const counts = getItemCountsWithPrice(
				[
					{ itemType: 'Bandage', cost: 10 },
					{ cardType: 'Blink', cost: 130 } as any,
					{ cardType: 'Blink', cost: 130 } as any
				],
				2
			);

			expect(counts).to.deep.equal({
				Bandage: { count: 1, cost: 20 },
				Blink: { count: 2, cost: 260 }
			});
		});
	});
});

const { expect } = require('../shared/test-setup');

const { sort } = require('./sort');

describe('./helpers/sort.js', () => {
	const unsortedCards = [
		{ cardType: 'b', level: 1 },
		{ cardType: 'a', level: 0 },
		{ cardType: 'd', level: 2 }
	];
	const sortedCards = [
		{ cardType: 'a', level: 0 },
		{ cardType: 'b', level: 1 },
		{ cardType: 'd', level: 2 }
	];

	describe('sort', () => {
		it('sorts by cardType by default', () => {
			expect(sort(unsortedCards)).to.deep.equal(sortedCards);
		});

		it('sorts by level if specified', () => {
			expect(sort(unsortedCards, 'level')).to.deep.equal(sortedCards);
		});
	});
});

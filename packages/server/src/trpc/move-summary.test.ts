import { expect } from 'chai';
import { movedSummary } from './move-summary.js';

describe('movedSummary', () => {
	it('uses the singular for one card', () => {
		expect(movedSummary(1, 'Fang', 'Stonefang')).to.equal('Moved 1 card from Fang to Stonefang.');
	});
	it('uses the plural otherwise', () => {
		expect(movedSummary(2, 'Fang', 'Stonefang')).to.equal('Moved 2 cards from Fang to Stonefang.');
		expect(movedSummary(0, 'Fang', 'Stonefang')).to.equal('Moved 0 cards from Fang to Stonefang.');
	});
	it('names the card on the single-card path', () => {
		expect(movedSummary(1, 'A', 'B', 'Hit')).to.equal('Moved 1 Hit from A to B.');
		expect(movedSummary(2, 'A', 'B', 'Hit')).to.equal('Moved 2 Hit cards from A to B.');
	});
});

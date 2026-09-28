import { expect } from 'chai';

import { fromHE, isotonic, toHE, type Ladder } from './ladder.js';

/** The ladder conversion (roadmap 34 task 3): monotone smoothing and its inverse. */
describe('balance/ladder', () => {
	const ladder: Ladder = { 3: [0, 0.05, 0.1, 0.18, 0.25, 0.32, 0.38, 0.43, 0.47, 0.5] };

	it('pools adjacent violators into a non-decreasing curve', () => {
		expect(isotonic([0.1, 0.3, 0.2, 0.4])).to.deep.equal([0.1, 0.25, 0.25, 0.4]);
		expect(isotonic([0, 0.1, 0.2])).to.deep.equal([0, 0.1, 0.2]);
	});

	it('maps a score to Hit-equivalents and back, linearly between rungs', () => {
		expect(toHE(ladder, 3, 0.25)).to.equal(4);
		expect(toHE(ladder, 3, 0.215)).to.be.closeTo(3.5, 1e-9);
		expect(fromHE(ladder, 3, 3.5)).to.be.closeTo(0.215, 1e-9);
		expect(fromHE(ladder, 3, toHE(ladder, 3, 0.4))).to.be.closeTo(0.4, 1e-9);
	});

	it('clamps to the ends of the ladder', () => {
		expect(toHE(ladder, 3, -0.1)).to.equal(0);
		expect(toHE(ladder, 3, 0.6)).to.equal(9);
		expect(fromHE(ladder, 3, 12)).to.equal(0.5);
		expect(() => toHE(ladder, 5, 0.3)).to.throw('No ladder');
	});
});

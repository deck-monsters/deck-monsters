import { expect } from 'chai';

import { fightsForHalfWidth, holm, meanInterval, normalCdf, normalQuantile, pValueAgainstZero, sprt, wilson } from './stats.js';

/** Known textbook values, so a later edit cannot quietly break an interval (roadmap 34 task 1). */
describe('balance/stats', () => {
	it('normal quantile and CDF', () => {
		expect(normalQuantile(0.975)).to.be.closeTo(1.959964, 1e-6);
		expect(normalQuantile(0.5)).to.be.closeTo(0, 1e-9);
		expect(normalQuantile(0.001)).to.be.closeTo(-3.090232, 1e-6);
		expect(normalCdf(1.96)).to.be.closeTo(0.9750021, 1e-6);
		expect(normalCdf(-1)).to.be.closeTo(0.1586553, 1e-6);
	});

	it('Wilson interval for 8 of 10 is 0.490 to 0.943', () => {
		const { estimate, low, high } = wilson(8, 10);
		expect(estimate).to.equal(0.8);
		expect(low).to.be.closeTo(0.4902, 1e-4);
		expect(high).to.be.closeTo(0.9433, 1e-4);
	});

	it('sample sizes for ±5 and ±3 points', () => {
		expect(fightsForHalfWidth(0.05)).to.equal(385);
		expect(fightsForHalfWidth(0.03)).to.equal(1068);
	});

	it('mean interval and p-value of a sample', () => {
		const { estimate, low, high } = meanInterval([1, 2, 3, 4, 5]);
		expect(estimate).to.equal(3);
		expect(high - estimate).to.be.closeTo(1.3859, 1e-4);
		expect(low).to.be.closeTo(3 - 1.3859, 1e-4);
		expect(pValueAgainstZero([1, -1, 1, -1])).to.be.closeTo(1, 1e-6);
		expect(pValueAgainstZero([2, 2.1, 1.9, 2.05])).to.be.below(1e-6);
	});

	it('Holm stops at the first p-value above its threshold', () => {
		expect(holm([0.01, 0.04, 0.03, 0.005])).to.deep.equal([true, false, false, true]);
		expect(holm([0.2, 0.3])).to.deep.equal([false, false]);
	});

	it('SPRT decides above, below, or continue', () => {
		expect(sprt(70, 100, 0.45, 0.55)).to.equal('above');
		expect(sprt(30, 100, 0.45, 0.55)).to.equal('below');
		expect(sprt(50, 100, 0.45, 0.55)).to.equal('continue');
	});
});

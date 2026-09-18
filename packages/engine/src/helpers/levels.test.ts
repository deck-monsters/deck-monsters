import { expect } from 'chai';

import { getLevel, rawLevelThreshold, discountedLevelThreshold } from './levels.js';
import { EARLY_XP_DISCOUNT_CONVERGE_LEVEL } from '../constants/progression.js';

describe('./helpers/levels.ts', () => {
	describe('rawLevelThreshold (the original, undiscounted curve)', () => {
		it('matches the historical Fibonacci-style thresholds', () => {
			// These are the exact numbers the old recursive getLevel() produced before
			// the early-game discount was introduced (docs/roadmap/11-balance-and-
			// mechanics.md "Early progression front-loading"). Kept as a regression check
			// that mid/late-game pacing — the part of the curve the player feedback said
			// was fine — is untouched.
			expect(rawLevelThreshold(1)).to.equal(50);
			expect(rawLevelThreshold(2)).to.equal(100);
			expect(rawLevelThreshold(3)).to.equal(150);
			expect(rawLevelThreshold(4)).to.equal(250);
			expect(rawLevelThreshold(5)).to.equal(400);
			expect(rawLevelThreshold(6)).to.equal(650);
			expect(rawLevelThreshold(7)).to.equal(1050);
		});
	});

	describe('discountedLevelThreshold (front-loaded early curve)', () => {
		it('is cheaper than the raw curve for every early level', () => {
			for (let level = 1; level < EARLY_XP_DISCOUNT_CONVERGE_LEVEL; level += 1) {
				expect(discountedLevelThreshold(level)).to.be.lessThan(rawLevelThreshold(level));
			}
		});

		it('exactly matches the raw curve from the convergence level on', () => {
			for (let level = EARLY_XP_DISCOUNT_CONVERGE_LEVEL; level <= 10; level += 1) {
				expect(discountedLevelThreshold(level)).to.equal(rawLevelThreshold(level));
			}
		});

		it('produces the specific front-loaded thresholds this change was tuned to', () => {
			expect(discountedLevelThreshold(1)).to.equal(28);
			expect(discountedLevelThreshold(2)).to.equal(65);
			expect(discountedLevelThreshold(3)).to.equal(113);
			expect(discountedLevelThreshold(4)).to.equal(213);
			expect(discountedLevelThreshold(5)).to.equal(380);
			expect(discountedLevelThreshold(6)).to.equal(650);
		});
	});

	describe('getLevel', () => {
		it('starts at level 0', () => {
			expect(getLevel(0)).to.equal(0);
			expect(getLevel(27)).to.equal(0);
		});

		it('reaches level 1 much sooner than the old 50xp threshold', () => {
			expect(getLevel(28)).to.equal(1);
			// Old curve required 50xp for level 1; the new curve reaches it in roughly
			// half that — the front-loading this change exists to deliver.
			expect(getLevel(49)).to.equal(1);
		});

		it('matches the old curve exactly by the convergence level', () => {
			expect(getLevel(649)).to.equal(5);
			expect(getLevel(650)).to.equal(6);
			expect(getLevel(1049)).to.equal(6);
			expect(getLevel(1050)).to.equal(7);
		});

		it('is monotonically non-decreasing as xp increases', () => {
			let previousLevel = 0;
			for (let xp = 0; xp <= 2000; xp += 17) {
				const level = getLevel(xp);
				expect(level).to.be.at.least(previousLevel);
				previousLevel = level;
			}
		});
	});
});

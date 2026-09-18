import { expect } from 'chai';

import {
	earlyXpDiscount,
	EARLY_XP_DISCOUNT_FLOOR,
	EARLY_XP_DISCOUNT_CONVERGE_LEVEL,
	earlyCoinBonus,
	EARLY_COIN_BONUS_TIERS,
	earlyDropBoost,
	EARLY_DROP_BOOST_MAX,
	EARLY_DROP_BOOST_CONVERGE_LEVEL,
} from './progression.js';

describe('./constants/progression.ts', () => {
	describe('earlyXpDiscount', () => {
		it('starts at the floor for level 1', () => {
			expect(earlyXpDiscount(1)).to.be.closeTo(EARLY_XP_DISCOUNT_FLOOR + 0.1, 1e-9);
		});

		it('increases monotonically with level', () => {
			for (let level = 1; level < EARLY_XP_DISCOUNT_CONVERGE_LEVEL; level += 1) {
				expect(earlyXpDiscount(level + 1)).to.be.greaterThan(earlyXpDiscount(level));
			}
		});

		it('converges to (and stays at) 1.0 from the configured level on', () => {
			expect(earlyXpDiscount(EARLY_XP_DISCOUNT_CONVERGE_LEVEL)).to.equal(1);
			expect(earlyXpDiscount(EARLY_XP_DISCOUNT_CONVERGE_LEVEL + 5)).to.equal(1);
			expect(earlyXpDiscount(100)).to.equal(1);
		});

		it('never exceeds 1.0 (never makes leveling slower than the raw curve)', () => {
			for (let level = 0; level <= 20; level += 1) {
				expect(earlyXpDiscount(level)).to.be.at.most(1);
			}
		});
	});

	describe('earlyCoinBonus', () => {
		it('pays the highest tier for a brand-new player', () => {
			expect(earlyCoinBonus(0)).to.equal(EARLY_COIN_BONUS_TIERS[0]!.bonus);
		});

		it('tapers down through the configured tiers', () => {
			let previous = Infinity;
			for (let fights = 0; fights <= 12; fights += 1) {
				const bonus = earlyCoinBonus(fights);
				expect(bonus).to.be.at.most(previous);
				previous = bonus;
			}
		});

		it('is zero once a player is past every tier', () => {
			const lastTier = EARLY_COIN_BONUS_TIERS[EARLY_COIN_BONUS_TIERS.length - 1]!;
			expect(earlyCoinBonus(lastTier.untilFightsPlayed)).to.equal(0);
			expect(earlyCoinBonus(lastTier.untilFightsPlayed + 50)).to.equal(0);
		});
	});

	describe('earlyDropBoost', () => {
		it('is at its maximum for a level 0 monster', () => {
			expect(earlyDropBoost(0)).to.equal(EARLY_DROP_BOOST_MAX);
		});

		it('decreases monotonically with level', () => {
			for (let level = 0; level < EARLY_DROP_BOOST_CONVERGE_LEVEL; level += 1) {
				expect(earlyDropBoost(level + 1)).to.be.lessThan(earlyDropBoost(level));
			}
		});

		it('converges to (and never drops below) 1x from the configured level on', () => {
			expect(earlyDropBoost(EARLY_DROP_BOOST_CONVERGE_LEVEL)).to.equal(1);
			expect(earlyDropBoost(EARLY_DROP_BOOST_CONVERGE_LEVEL + 10)).to.equal(1);
		});
	});
});

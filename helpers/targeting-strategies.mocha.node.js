const { expect } = require('../shared/test-setup');
const { randomContestant } = require('./bosses');
const targetingStrategies = require('./targeting-strategies');

describe('./helpers/targeting-strategies.js', () => {
	const getContestants = () => {
		const playerContestant = randomContestant({
			isBoss: false,
			battles: {
				total: 1,
				wins: 1,
				losses: 0
			},
			hpVariance: 0
		});

		const level1 = randomContestant({
			isBoss: false,
			battles: {
				total: 5,
				wins: 5,
				losses: 0
			},
			hpVariance: 0
		});

		const level2 = randomContestant({
			isBoss: false,
			battles: {
				total: 10,
				wins: 10,
				losses: 0
			},
			hpVariance: 0
		});

		const level3 = randomContestant({
			isBoss: false,
			battles: {
				total: 15,
				wins: 15,
				losses: 0
			},
			hpVariance: 0
		});

		return {
			playerContestant,
			level1,
			level2,
			level3,
			contestants: [playerContestant, level3, level1, level2]
		};
	};

	describe('TARGET_HIGHEST_HP_PLAYER', () => {
		it('gets the target with the higest hp', () => {
			const {
				playerContestant,
				level1,
				level2,
				level3,
				contestants
			} = getContestants();

			level1.monster.hp = 5;
			level2.monster.hp = 5;

			const target = targetingStrategies.getTarget({
				playerContestant,
				contestants,
				strategy: targetingStrategies.TARGET_HIGHEST_HP_PLAYER
			});

			expect(target.monster.givenName).to.equal(level3.monster.givenName);
		});

		it('gets the target with the higest current hp', () => {
			const {
				playerContestant,
				level1,
				level2,
				level3,
				contestants
			} = getContestants();

			level1.monster.hp = 5;
			level3.monster.hp = 5;

			const target = targetingStrategies.getTarget({
				playerContestant,
				contestants,
				strategy: targetingStrategies.TARGET_HIGHEST_HP_PLAYER
			});

			expect(target.monster.givenName).to.equal(level2.monster.givenName);
		});
	});

	describe('TARGET_MAX_HP_PLAYER', () => {
		it('gets the target with the higest max hp', () => {
			const {
				playerContestant,
				level3,
				contestants
			} = getContestants();

			const target = targetingStrategies.getTarget({
				playerContestant,
				contestants,
				strategy: targetingStrategies.TARGET_MAX_HP_PLAYER
			});

			expect(target.monster.givenName).to.equal(level3.monster.givenName);
		});
	});

	describe('TARGET_NEXT_PLAYER', () => {
		it('gets the next target in order of play', () => {
			const {
				playerContestant,
				level3,
				contestants
			} = getContestants();

			const target = targetingStrategies.getTarget({
				playerContestant,
				contestants,
				strategy: targetingStrategies.TARGET_NEXT_PLAYER
			});

			expect(target.monster.givenName).to.equal(level3.monster.givenName);
		});

		it('defaults to TARGET_NEXT_PLAYER', () => {
			const {
				level3: playerContestant,
				level1,
				contestants
			} = getContestants();

			const target = targetingStrategies.getTarget({
				playerContestant,
				contestants,
				strategy: targetingStrategies.TARGET_NEXT_PLAYER
			});

			expect(target.monster.givenName).to.equal(level1.monster.givenName);
		});
	});
});
